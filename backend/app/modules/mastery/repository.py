from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import Concept, ConceptMastery, MasteryEvent


async def sum_recent_event_deltas_for_topic(
    db: AsyncSession, topic_id: int, user_id: int, since: datetime
) -> float:
    """Net mastery-score movement across every concept in a topic since
    `since` -- Goal Prediction's trend signal. Deliberately net (not just
    gains): a run of wrong answers should pull the trend down, not be
    ignored."""
    stmt = (
        select(func.coalesce(func.sum(MasteryEvent.delta), 0.0))
        .select_from(MasteryEvent)
        .join(ConceptMastery, ConceptMastery.id == MasteryEvent.concept_mastery_id)
        .join(Concept, Concept.id == ConceptMastery.concept_id)
        .where(
            Concept.topic_id == topic_id,
            ConceptMastery.user_id == user_id,
            MasteryEvent.created_at >= since,
        )
    )
    result = await db.execute(stmt)
    return float(result.scalar_one())


async def resolve_concept(db: AsyncSession, topic_id: int, name: str) -> Concept:
    """Case-insensitive get-or-create -- quiz/flashcard generation supplies a
    free-text concept label per item; this collapses "Krebs Cycle" and
    "krebs cycle" onto the same row without requiring exact-match generation."""
    normalized = name.strip()
    stmt = select(Concept).where(
        Concept.topic_id == topic_id, func.lower(Concept.name) == normalized.lower()
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing is not None:
        return existing

    concept = Concept(topic_id=topic_id, name=normalized[:200])
    db.add(concept)
    await db.flush()
    return concept


async def get_or_create_mastery(db: AsyncSession, user_id: int, concept_id: int) -> ConceptMastery:
    stmt = select(ConceptMastery).where(
        ConceptMastery.user_id == user_id, ConceptMastery.concept_id == concept_id
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing is not None:
        return existing

    mastery = ConceptMastery(user_id=user_id, concept_id=concept_id)
    db.add(mastery)
    await db.flush()
    return mastery


async def update_mastery(
    db: AsyncSession,
    mastery: ConceptMastery,
    *,
    mastery_score: float,
    confidence_score: float,
    event_count: int,
    assessed_at: datetime,
) -> ConceptMastery:
    mastery.mastery_score = mastery_score
    mastery.confidence_score = confidence_score
    mastery.event_count = event_count
    mastery.last_assessed_at = assessed_at
    await db.flush()
    await db.refresh(mastery)
    return mastery


async def create_event(
    db: AsyncSession,
    *,
    concept_mastery_id: int,
    source_type: str,
    source_id: int | None,
    quality: float,
    delta: float,
) -> MasteryEvent:
    event = MasteryEvent(
        concept_mastery_id=concept_mastery_id, source_type=source_type,
        source_id=source_id, quality=quality, delta=delta,
    )
    db.add(event)
    await db.flush()
    return event


async def list_mastery_for_topic(
    db: AsyncSession, topic_id: int, user_id: int
) -> list[tuple[ConceptMastery, Concept]]:
    stmt = (
        select(ConceptMastery, Concept)
        .join(Concept, Concept.id == ConceptMastery.concept_id)
        .where(Concept.topic_id == topic_id, ConceptMastery.user_id == user_id)
    )
    result = await db.execute(stmt)
    return [(row.ConceptMastery, row.Concept) for row in result]


async def list_mastery_for_user(db: AsyncSession, user_id: int) -> list[tuple[ConceptMastery, Concept]]:
    """Every concept the user has any mastery signal for, across all of
    their topics -- the Study Coach ranks urgency platform-wide, not one
    topic at a time."""
    stmt = (
        select(ConceptMastery, Concept)
        .join(Concept, Concept.id == ConceptMastery.concept_id)
        .where(ConceptMastery.user_id == user_id)
    )
    result = await db.execute(stmt)
    return [(row.ConceptMastery, row.Concept) for row in result]


async def list_concepts_for_topic(db: AsyncSession, topic_id: int) -> list[Concept]:
    """Every concept extracted for a topic, regardless of whether the user
    has any mastery signal for it yet -- the Knowledge Graph needs the full
    node set, not just the ones Weakness Detection has scored so far."""
    stmt = select(Concept).where(Concept.topic_id == topic_id).order_by(Concept.name)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_concept_by_id(db: AsyncSession, concept_id: int) -> Concept | None:
    return await db.get(Concept, concept_id)


async def count_concepts_by_topic(db: AsyncSession, topic_ids: list[int]) -> dict[int, int]:
    """Total extracted concepts per topic, regardless of mastery signal --
    the Analytics dashboard's topic breakdown needs the real graph size, not
    just concepts a quiz/flashcard has touched."""
    if not topic_ids:
        return {}
    stmt = (
        select(Concept.topic_id, func.count(Concept.id))
        .where(Concept.topic_id.in_(topic_ids))
        .group_by(Concept.topic_id)
    )
    result = await db.execute(stmt)
    return {topic_id: count for topic_id, count in result.all()}


async def get_concept_for_topic(db: AsyncSession, concept_id: int, topic_id: int) -> Concept | None:
    stmt = select(Concept).where(Concept.id == concept_id, Concept.topic_id == topic_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_mastery(db: AsyncSession, user_id: int, concept_id: int) -> ConceptMastery | None:
    stmt = select(ConceptMastery).where(
        ConceptMastery.user_id == user_id, ConceptMastery.concept_id == concept_id
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_events_for_mastery(
    db: AsyncSession, concept_mastery_id: int, limit: int = 50
) -> list[MasteryEvent]:
    stmt = (
        select(MasteryEvent)
        .where(MasteryEvent.concept_mastery_id == concept_mastery_id)
        .order_by(MasteryEvent.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())
