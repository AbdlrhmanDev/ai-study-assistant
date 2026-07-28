from dataclasses import dataclass
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from ..topics import service as topics_service
from . import repository, rules, streaks
from .leveling import level_progress


@dataclass
class AwardResult:
    xp_awarded: int
    leveled_up: bool
    new_level_name: str | None


NO_AWARD = AwardResult(xp_awarded=0, leveled_up=False, new_level_name=None)


def summarize_awards(*results: "AwardResult | None") -> dict:
    """Combines however many awards fired for one action (e.g. quiz XP plus
    a mastery milestone in the same answer) into the single summary the
    frontend needs to decide whether to show an XP toast / level-up
    moment."""
    present = [result for result in results if result is not None]
    total_xp = sum(result.xp_awarded for result in present)
    level_up = next((result for result in present if result.leveled_up), None)
    return {
        "xpEarned": total_xp,
        "leveledUp": level_up is not None,
        "newLevelName": level_up.new_level_name if level_up else None,
    }


async def _award(
    db: AsyncSession,
    *,
    user_id: int,
    topic_id: int | None,
    amount: int,
    source_type: str,
    source_id: int | None,
    description: str,
) -> AwardResult:
    if amount <= 0 or topic_id is None:
        return NO_AWARD
    await repository.add_xp_event(
        db, user_id=user_id, topic_id=topic_id, amount=amount,
        source_type=source_type, source_id=source_id, description=description,
    )
    level = await repository.get_or_create_level(db, user_id, topic_id)
    previous_level_name = level_progress(level.total_xp).level_name
    level = await repository.add_xp_to_level(db, level, amount)
    new_level_name = level_progress(level.total_xp).level_name
    leveled_up = new_level_name != previous_level_name
    return AwardResult(
        xp_awarded=amount, leveled_up=leveled_up,
        new_level_name=new_level_name if leveled_up else None,
    )


async def award_quiz_xp(
    db: AsyncSession, *, user_id: int, topic_id: int, difficulty_score: float, source_id: int
) -> AwardResult:
    amount = rules.quiz_correct_xp(difficulty_score)
    return await _award(
        db, user_id=user_id, topic_id=topic_id, amount=amount,
        source_type="quiz", source_id=source_id, description="Correct quiz answer",
    )


async def award_flashcard_xp(
    db: AsyncSession, *, user_id: int, topic_id: int, rating: str, previous_rating: str | None, source_id: int
) -> AwardResult:
    amount = rules.flashcard_review_xp(rating, previous_rating)
    description = "Recovered a difficult flashcard" if amount > rules.FLASHCARD_REVIEW_XP else "Flashcard review"
    return await _award(
        db, user_id=user_id, topic_id=topic_id, amount=amount,
        source_type="flashcard", source_id=source_id, description=description,
    )


async def award_sparring_xp(db: AsyncSession, *, user_id: int, topic_id: int, source_id: int) -> AwardResult:
    return await _award(
        db, user_id=user_id, topic_id=topic_id, amount=rules.sparring_win_xp(),
        source_type="sparring", source_id=source_id, description="Won a Socratic Sparring round",
    )


async def award_mastery_milestone_xp(
    db: AsyncSession,
    *,
    user_id: int,
    topic_id: int,
    concept_mastery_id: int,
    previous_score: float,
    new_score: float,
) -> AwardResult | None:
    milestone = rules.crossed_milestone(previous_score, new_score)
    if milestone is None:
        return None
    if await repository.has_milestone_event(db, user_id, concept_mastery_id, milestone):
        return None
    return await _award(
        db, user_id=user_id, topic_id=topic_id, amount=rules.mastery_milestone_xp(),
        source_type="mastery_milestone", source_id=concept_mastery_id,
        description=f"Reached {int(milestone * 100)}% mastery",
    )


async def record_graded_action(db: AsyncSession, user_id: int, *, today: date | None = None) -> None:
    """Extends (or starts) the platform-wide daily streak. Called once per
    graded action -- a quiz answer, a flashcard review, a real tutor
    question, or a sparring round -- never for merely opening the app."""
    streak = await repository.get_or_create_streak(db, user_id)
    current_date = today or date.today()
    new_current = streaks.next_streak(streak.current_streak, streak.last_active_date, current_date)
    new_longest = max(streak.longest_streak, new_current)
    await repository.update_streak(
        db, streak, current_streak=new_current, longest_streak=new_longest, last_active_date=current_date,
    )


async def get_topic_progress(db: AsyncSession, topic_id: int, user_id: int) -> dict:
    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    level = await repository.get_level(db, user_id, topic_id)
    progress = level_progress(level.total_xp if level else 0)
    return {
        "levelName": progress.level_name,
        "totalXp": progress.total_xp,
        "nextLevelName": progress.next_level_name,
        "xpIntoLevel": progress.xp_into_level,
        "xpForNextLevel": progress.xp_for_next_level,
    }


async def get_streak(db: AsyncSession, user_id: int) -> dict:
    streak = await repository.get_or_create_streak(db, user_id)
    return {
        "currentStreak": streak.current_streak,
        "longestStreak": streak.longest_streak,
        "lastActiveDate": streak.last_active_date.isoformat() if streak.last_active_date else None,
    }
