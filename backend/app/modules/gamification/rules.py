"""Deterministic XP rules -- no LLM in this path, same reasoning as
mastery/scoring.py: these numbers must be fast, free, and auditable, and a
gamification number a student can't reconstruct erodes trust in the whole
system."""

BASE_QUIZ_XP = 10
FLASHCARD_REVIEW_XP = 5
FLASHCARD_RECOVERY_BONUS = 15
SPARRING_WIN_XP = 50
MASTERY_MILESTONE_XP = 25

# Mastery milestones that earn a one-time bonus the first time they're
# crossed -- rewards improvement, not volume.
MASTERY_MILESTONES: tuple[float, ...] = (0.4, 0.7, 0.9)


def quiz_correct_xp(difficulty_score: float) -> int:
    """Harder correct answers are worth more: a difficulty_score of 0 pays
    base XP, 1.0 pays double."""
    weight = 1.0 + max(0.0, min(1.0, difficulty_score))
    return round(BASE_QUIZ_XP * weight)


def flashcard_review_xp(rating: str, previous_rating: str | None) -> int:
    """Zero for admitting difficulty (that's a signal, not evidence of
    recall); a recovery bonus for turning a previous hard/forgot into an
    easy/medium; otherwise the flat review XP."""
    if rating in ("hard", "forgot"):
        return 0
    recovered = previous_rating in ("hard", "forgot")
    return FLASHCARD_REVIEW_XP + (FLASHCARD_RECOVERY_BONUS if recovered else 0)


def sparring_win_xp() -> int:
    return SPARRING_WIN_XP


def mastery_milestone_xp() -> int:
    return MASTERY_MILESTONE_XP


def crossed_milestone(previous_score: float, new_score: float) -> float | None:
    """The single milestone (if any) `new_score` just crossed that
    `previous_score` hadn't -- callers still need to dedupe against
    already-awarded milestones per concept, since a score can dip and climb
    back across the same line more than once."""
    for milestone in MASTERY_MILESTONES:
        if previous_score < milestone <= new_score:
            return milestone
    return None
