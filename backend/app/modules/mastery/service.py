from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..gamification import service as gamification_service
from ..gamification.service import AwardResult
from ..topics import service as topics_service
from . import repository, scoring
from .exceptions import ConceptNotFoundError
from .model import Concept, ConceptMastery


@dataclass
class MasteryEventResult:
    mastery: ConceptMastery | None
    milestone_award: AwardResult | None


async def record_mastery_event(
    db: AsyncSession,
    *,
    user_id: int,
    topic_id: int,
    concept_name: str,
    source_type: str,
    source_id: int | None,
    quality: float,
) -> MasteryEventResult:
    """Called by quiz grading, flashcard reviews, and sparring sessions right
    after they know whether the student got something right. Resolves the
    free-text concept label to a canonical `Concept`, updates that
    (user, concept)'s mastery via an EMA toward `quality`, and logs the
    event. Never raises on a missing/empty concept label -- weakness
    tracking is best-effort and must never break the caller's real flow."""
    concept_name = (concept_name or "").strip()
    if not concept_name:
        return MasteryEventResult(mastery=None, milestone_award=None)

    concept = await repository.resolve_concept(db, topic_id, concept_name)
    mastery = await repository.get_or_create_mastery(db, user_id, concept.id)
    previous_score = mastery.mastery_score

    update = scoring.apply_event(
        current_score=mastery.mastery_score,
        current_event_count=mastery.event_count,
        quality=quality,
    )
    now = datetime.now(timezone.utc)
    mastery = await repository.update_mastery(
        db, mastery,
        mastery_score=update.mastery_score,
        confidence_score=update.confidence_score,
        event_count=update.event_count,
        assessed_at=now,
    )
    await repository.create_event(
        db, concept_mastery_id=mastery.id, source_type=source_type,
        source_id=source_id, quality=quality, delta=update.delta,
    )
    milestone_award = await gamification_service.award_mastery_milestone_xp(
        db, user_id=user_id, topic_id=topic_id, concept_mastery_id=mastery.id,
        previous_score=previous_score, new_score=update.mastery_score,
    )
    return MasteryEventResult(mastery=mastery, milestone_award=milestone_award)


def _serialize(mastery: ConceptMastery, concept: Concept, now: datetime) -> dict:
    effective = scoring.effective_mastery(
        mastery_score=mastery.mastery_score,
        decay_rate=mastery.decay_rate,
        last_assessed_at=mastery.last_assessed_at,
        now=now,
    )
    return {
        "conceptId": concept.id,
        "conceptName": concept.name,
        "masteryScore": round(effective, 3),
        "rawMasteryScore": round(mastery.mastery_score, 3),
        "confidenceScore": round(mastery.confidence_score, 3),
        "eventCount": mastery.event_count,
        "lastAssessedAt": mastery.last_assessed_at.isoformat() if mastery.last_assessed_at else None,
    }


async def list_weak_concepts(
    db: AsyncSession, topic_id: int, user_id: int, limit: int = 10
) -> list[dict]:
    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    rows = await repository.list_mastery_for_topic(db, topic_id, user_id)
    now = datetime.now(timezone.utc)
    serialized = [_serialize(mastery, concept, now) for mastery, concept in rows]
    serialized.sort(key=lambda item: item["masteryScore"])
    return serialized[:limit]


@dataclass
class ConceptSignal:
    concept_id: int
    concept_name: str
    topic_id: int
    mastery_score: float  # effective (decayed), 0-1


async def list_all_concepts_with_mastery(db: AsyncSession, topic_id: int, user_id: int) -> list[dict]:
    """Every concept extracted for the topic, each paired with the user's
    effective mastery (0.0 if never assessed) -- the Knowledge Graph colors
    every node, not just ones Weakness Detection has scored so far."""
    concepts = await repository.list_concepts_for_topic(db, topic_id)
    mastery_rows = await repository.list_mastery_for_topic(db, topic_id, user_id)
    now = datetime.now(timezone.utc)
    mastery_by_concept = {
        concept.id: scoring.effective_mastery(
            mastery_score=mastery.mastery_score, decay_rate=mastery.decay_rate,
            last_assessed_at=mastery.last_assessed_at, now=now,
        )
        for mastery, concept in mastery_rows
    }
    event_count_by_concept = {concept.id: mastery.event_count for mastery, concept in mastery_rows}
    return [
        {
            "conceptId": concept.id,
            "conceptName": concept.name,
            "description": concept.description,
            "masteryScore": round(mastery_by_concept.get(concept.id, 0.0), 3),
            "eventCount": event_count_by_concept.get(concept.id, 0),
        }
        for concept in concepts
    ]


async def list_all_concepts_for_planning(db: AsyncSession, user_id: int) -> list[ConceptSignal]:
    """Every concept the user has mastery data for, across all topics, with
    decay already applied -- feeds the Study Coach's ranking, which needs
    topic_id per concept (unlike the public weak-concepts API)."""
    rows = await repository.list_mastery_for_user(db, user_id)
    now = datetime.now(timezone.utc)
    return [
        ConceptSignal(
            concept_id=concept.id,
            concept_name=concept.name,
            topic_id=concept.topic_id,
            mastery_score=scoring.effective_mastery(
                mastery_score=mastery.mastery_score, decay_rate=mastery.decay_rate,
                last_assessed_at=mastery.last_assessed_at, now=now,
            ),
        )
        for mastery, concept in rows
    ]


async def count_concepts_by_topic(db: AsyncSession, topic_ids: list[int]) -> dict[int, int]:
    return await repository.count_concepts_by_topic(db, topic_ids)


async def sum_recent_event_deltas_for_topic(
    db: AsyncSession, topic_id: int, user_id: int, since: datetime
) -> float:
    return await repository.sum_recent_event_deltas_for_topic(db, topic_id, user_id, since)


async def get_concept_history(db: AsyncSession, topic_id: int, concept_id: int, user_id: int) -> dict:
    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    concept = await repository.get_concept_for_topic(db, concept_id, topic_id)
    if concept is None:
        raise ConceptNotFoundError()

    mastery = await repository.get_mastery(db, user_id, concept_id)
    if mastery is None:
        return {"conceptId": concept.id, "conceptName": concept.name, "events": []}

    events = await repository.list_events_for_mastery(db, mastery.id)
    return {
        "conceptId": concept.id,
        "conceptName": concept.name,
        "masteryScore": round(
            scoring.effective_mastery(
                mastery_score=mastery.mastery_score, decay_rate=mastery.decay_rate,
                last_assessed_at=mastery.last_assessed_at,
            ), 3,
        ),
        "events": [
            {
                "sourceType": event.source_type,
                "sourceId": event.source_id,
                "quality": event.quality,
                "delta": round(event.delta, 3),
                "createdAt": event.created_at.isoformat(),
            }
            for event in events
        ],
    }
