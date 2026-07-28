"""Pure spaced-repetition scheduling logic (SM-2), no DB/IO -- kept isolated
so it's trivially unit-testable, same reasoning as `ai/rag.py::score_bm25`.

Ratings map to the classic SM-2 "quality of recall" scale (0-5):
  forgot -> 0   (didn't recall at all -- restart the learning curve)
  hard   -> 3   (recalled, but it was a struggle)
  medium -> 4   (recalled correctly with some effort)
  easy   -> 5   (recalled perfectly, no hesitation)
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

Rating = str  # "easy" | "medium" | "hard" | "forgot"

RATING_QUALITY: dict[Rating, int] = {"forgot": 0, "hard": 3, "medium": 4, "easy": 5}
MIN_EASE_FACTOR = 1.3
DEFAULT_EASE_FACTOR = 2.5


@dataclass
class ScheduleResult:
    repetitions: int
    ease_factor: float
    interval_days: int
    due_at: datetime
    quality: int


def schedule_next_review(
    rating: Rating,
    *,
    repetitions: int,
    ease_factor: float,
    interval_days: int,
    now: datetime | None = None,
) -> ScheduleResult:
    if rating not in RATING_QUALITY:
        raise ValueError(f"Unknown rating: {rating!r}")

    now = now or datetime.now(timezone.utc)
    quality = RATING_QUALITY[rating]

    if quality < 3:
        # Forgot it (or worse) -- back to square one, review again tomorrow.
        next_repetitions = 0
        next_interval = 1
    else:
        if repetitions == 0:
            next_interval = 1
        elif repetitions == 1:
            next_interval = 6
        else:
            next_interval = max(1, round(interval_days * ease_factor))
        next_repetitions = repetitions + 1

    next_ease = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    next_ease = max(MIN_EASE_FACTOR, next_ease)

    return ScheduleResult(
        repetitions=next_repetitions,
        ease_factor=next_ease,
        interval_days=next_interval,
        due_at=now + timedelta(days=next_interval),
        quality=quality,
    )
