from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..ai import provider
from ..study_history import repository as study_history_repository
from . import repository, scoring
from .exceptions import InvalidLearningStyleWeightsError
from .model import LearningStyleProfile

RATIONALE_INSTRUCTIONS = """You are describing a student's inferred learning-style profile to them.
Given their top one or two preferred study modalities (out of: visual, reading, practice, flashcards,
examples, conversation) and how many engagement events informed it, write ONE short, friendly sentence
(under 25 words) noting the pattern. Plain text only, no markdown, no quotation marks."""

AXIS_LABELS = {
    "visual": "visual materials like the knowledge graph",
    "reading": "reading and writing notes",
    "practice": "hands-on practice with quizzes",
    "flashcards": "flashcard review",
    "examples": "worked examples and explanations",
    "conversation": "conversational, chat-based learning",
}


def _fallback_rationale(weights: dict[str, float], total_events: int) -> str:
    if total_events < scoring.MIN_EVENTS_FOR_SIGNAL:
        return "Not enough activity yet to detect a preference -- keep studying and this will sharpen up."
    top = scoring.dominant_axes(weights, top_n=1)[0]
    return f"Based on {total_events} tracked activities, you tend to engage most with {AXIS_LABELS[top]}."


async def _generate_rationale(weights: dict[str, float], total_events: int) -> str:
    if total_events < scoring.MIN_EVENTS_FOR_SIGNAL:
        return _fallback_rationale(weights, total_events)
    top_axes = scoring.dominant_axes(weights, top_n=2)
    prompt = (
        f"Top modalities: {', '.join(AXIS_LABELS[axis] for axis in top_axes)}. "
        f"Total engagement events: {total_events}."
    )
    try:
        answer, _provider_name, _model_name = await provider.generate(prompt, instructions=RATIONALE_INSTRUCTIONS)
        return answer.strip() or _fallback_rationale(weights, total_events)
    except Exception:
        return _fallback_rationale(weights, total_events)


def _serialize(profile: LearningStyleProfile) -> dict:
    weights = {axis: getattr(profile, axis) for axis in scoring.AXES}
    return {
        "weights": weights,
        "dominantAxes": scoring.dominant_axes(weights, top_n=2),
        "eventCount": profile.event_count,
        "overridden": profile.overridden,
        "rationale": profile.rationale,
        "computedAt": profile.computed_at.isoformat() if profile.computed_at else None,
    }


async def get_profile(db: AsyncSession, user_id: int) -> dict:
    profile = await repository.get_or_create_profile(db, user_id)
    if not profile.overridden:
        activity_counts = await study_history_repository.count_activities_by_type(db, user_id)
        weights, total_events = scoring.compute_profile(activity_counts)
        if profile.computed_at is None or total_events != profile.event_count:
            rationale = await _generate_rationale(weights, total_events)
            profile = await repository.save_computed(
                db, profile, weights=weights, event_count=total_events,
                rationale=rationale, computed_at=datetime.now(timezone.utc),
            )
    await db.commit()
    return _serialize(profile)


async def update_profile(db: AsyncSession, user_id: int, weights: dict[str, float]) -> dict:
    if set(weights.keys()) != set(scoring.AXES) or any(value < 0 for value in weights.values()):
        raise InvalidLearningStyleWeightsError()
    total = sum(weights.values())
    if total <= 0:
        raise InvalidLearningStyleWeightsError()
    normalized = {axis: value / total for axis, value in weights.items()}

    profile = await repository.get_or_create_profile(db, user_id)
    profile = await repository.save_override(db, profile, weights=normalized)
    await db.commit()
    return _serialize(profile)


async def reset_profile(db: AsyncSession, user_id: int) -> dict:
    """Clears a manual override so the profile goes back to being computed
    from engagement activity on the next read."""
    profile = await repository.get_or_create_profile(db, user_id)
    profile.overridden = False
    profile.computed_at = None
    await db.flush()
    await db.commit()
    return await get_profile(db, user_id)
