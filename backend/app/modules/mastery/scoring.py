"""Pure mastery-scoring math, no DB/IO -- same isolation pattern as
flashcards/scheduler.py and quizzes/grading.py.

Mastery updates as an exponential moving average toward each new quality
signal (0-1), with the learning rate shrinking as evidence accumulates --
so mastery stabilizes rather than whipsawing on one bad quiz after twenty
good ones. Forgetting is applied separately, at *read* time, via
exponential decay against time since last assessed -- never baked into the
stored score, so "current mastery" always reflects now, not the last write.
"""
import math
from dataclasses import dataclass
from datetime import datetime, timezone

MIN_LEARNING_RATE = 0.08
MAX_LEARNING_RATE = 0.4
CONFIDENCE_SATURATION_EVENTS = 5


def _learning_rate(event_count: int) -> float:
    return max(MIN_LEARNING_RATE, MAX_LEARNING_RATE / (1 + event_count * 0.3))


@dataclass
class MasteryUpdate:
    mastery_score: float
    confidence_score: float
    event_count: int
    delta: float


def apply_event(*, current_score: float, current_event_count: int, quality: float) -> MasteryUpdate:
    quality = max(0.0, min(1.0, quality))
    rate = _learning_rate(current_event_count)
    next_score = current_score + rate * (quality - current_score)
    next_score = max(0.0, min(1.0, next_score))
    next_count = current_event_count + 1
    confidence = min(1.0, next_count / CONFIDENCE_SATURATION_EVENTS)
    return MasteryUpdate(
        mastery_score=next_score,
        confidence_score=confidence,
        event_count=next_count,
        delta=next_score - current_score,
    )


def effective_mastery(
    *,
    mastery_score: float,
    decay_rate: float,
    last_assessed_at: datetime | None,
    now: datetime | None = None,
) -> float:
    """Current, decayed mastery -- never above the stored score, never below 0."""
    if last_assessed_at is None or mastery_score <= 0:
        return mastery_score
    now = now or datetime.now(timezone.utc)
    days_elapsed = max(0.0, (now - last_assessed_at).total_seconds() / 86400)
    decayed = mastery_score * math.exp(-decay_rate * days_elapsed)
    return max(0.0, min(mastery_score, decayed))


RATING_QUALITY = {"forgot": 0.0, "hard": 0.4, "medium": 0.75, "easy": 1.0}


def quality_from_flashcard_rating(rating: str) -> float:
    return RATING_QUALITY.get(rating, 0.5)
