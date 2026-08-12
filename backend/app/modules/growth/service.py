from datetime import date, datetime, timedelta, timezone

from sqlalchemy import case, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai.model import ChatMessage
from ..study_history.model import StudyActivity
from ..topics.model import Topic
from ..users.model import User
from .model import AnswerFeedback, ProductEvent, ReminderPreference


async def record_event(db: AsyncSession, user_id: int, name: str, properties: dict | None = None) -> None:
    db.add(ProductEvent(user_id=user_id, name=name, properties=properties or {}))
    await db.commit()


def add_event(db: AsyncSession, user_id: int, name: str, properties: dict | None = None) -> None:
    """Attach telemetry to the caller's transaction without forcing a commit."""
    db.add(ProductEvent(user_id=user_id, name=name, properties=properties or {}))


async def rate_answer(db: AsyncSession, user_id: int, message_id: int, rating: int, reason: str | None, comment: str | None) -> AnswerFeedback:
    owned = await db.scalar(
        select(ChatMessage.id).join(Topic, Topic.id == ChatMessage.topic_id).where(
            ChatMessage.id == message_id, ChatMessage.role == "assistant", Topic.user_id == user_id
        )
    )
    if owned is None:
        from ...core.exceptions import AppError
        raise AppError("AI answer not found", 404)
    statement = insert(AnswerFeedback).values(
        user_id=user_id, message_id=message_id, rating=rating, reason=reason, comment=comment
    ).on_conflict_do_update(
        constraint="answer_feedback_user_message_unique",
        set_={"rating": rating, "reason": reason, "comment": comment, "updated_at": func.now()},
    ).returning(AnswerFeedback)
    feedback = (await db.execute(statement)).scalar_one()
    await db.commit()
    return feedback


async def get_preferences(db: AsyncSession, user_id: int) -> ReminderPreference:
    preference = await db.get(ReminderPreference, user_id)
    if preference is None:
        preference = ReminderPreference(user_id=user_id)
        db.add(preference)
        await db.commit()
        await db.refresh(preference)
    return preference


async def update_preferences(db: AsyncSession, user_id: int, *, email_enabled: bool, hour_local: int, timezone_name: str, minimum_due_cards: int) -> ReminderPreference:
    preference = await get_preferences(db, user_id)
    preference.email_enabled = email_enabled
    preference.hour_local = hour_local
    preference.timezone = timezone_name
    preference.minimum_due_cards = minimum_due_cards
    await db.commit()
    await db.refresh(preference)
    return preference


async def funnel_summary(db: AsyncSession, days: int) -> dict:
    since = datetime.now(timezone.utc).timestamp() - days * 86400
    since_dt = datetime.fromtimestamp(since, timezone.utc)
    rows = await db.execute(
        select(ProductEvent.name, func.count(func.distinct(ProductEvent.user_id)))
        .where(ProductEvent.created_at >= since_dt).group_by(ProductEvent.name)
    )
    counts = dict(rows.all())
    order = ["signup", "activation", "first_topic", "first_upload", "first_ai_answer", "first_quiz", "first_flashcard_review", "paid_conversion"]
    previous = None
    stages = []
    for name in order:
        users = int(counts.get(name, 0))
        stages.append({"name": name, "users": users, "conversionFromPrevious": round(users / previous, 3) if previous else None})
        previous = users
    feedback = await db.execute(
        select(func.count(AnswerFeedback.id), func.sum(case((AnswerFeedback.rating == 1, 1), else_=0)))
        .where(AnswerFeedback.created_at >= since_dt)
    )
    total, positive = feedback.one()
    return {"days": days, "stages": stages, "answerQuality": {"ratings": int(total or 0), "positiveRate": round(int(positive or 0) / int(total), 3) if total else None}}


def serialize_preferences(value: ReminderPreference) -> dict:
    return {"emailEnabled": value.email_enabled, "hourLocal": value.hour_local, "timezone": value.timezone, "minimumDueCards": value.minimum_due_cards}


async def retention_summary(db: AsyncSession, weeks: int = 8) -> dict:
    """Weekly signup cohorts and their retention. A user counts as active in a
    week if they produced any study activity or product event in it -- activity
    is the retention signal, not just app opens."""
    now = datetime.now(timezone.utc)
    cohort_cutoff = now - timedelta(weeks=weeks)

    signups_rows = await db.execute(
        select(User.id, func.date_trunc("week", User.created_at)).where(User.created_at >= cohort_cutoff)
    )
    # cohort week -> set of user ids signed up that week
    cohorts: dict[date, set[int]] = {}
    for user_id, week_start in signups_rows.all():
        cohorts.setdefault(week_start.date(), set()).add(user_id)

    # (user_id, week_start) pairs with any activity
    active_weeks: set[tuple[int, date]] = set()
    for rows in (
        await db.execute(
            select(StudyActivity.user_id, func.date_trunc("week", StudyActivity.created_at)).distinct()
        ),
        await db.execute(
            select(ProductEvent.user_id, func.date_trunc("week", ProductEvent.created_at))
            .where(ProductEvent.user_id.is_not(None))
            .distinct()
        ),
    ):
        active_weeks.update((user_id, week_start.date()) for user_id, week_start in rows.all())

    active_by_week: dict[date, set[int]] = {}
    for user_id, week_start in active_weeks:
        active_by_week.setdefault(week_start, set()).add(user_id)

    result_cohorts = []
    total_retained_w1 = 0
    total_retained_m1 = 0
    total_signups = 0
    for cohort_date in sorted(cohorts):
        signup_ids = cohorts[cohort_date]
        total_signups += len(signup_ids)
        week_counts = [
            len(active_by_week.get(cohort_date + timedelta(weeks=offset), set()) & signup_ids)
            for offset in range(weeks)
        ]
        retained_w1 = week_counts[1] / len(signup_ids) if len(signup_ids) and len(week_counts) > 1 else None
        retained_m1 = week_counts[4] / len(signup_ids) if len(signup_ids) and len(week_counts) > 4 else None
        if retained_w1 is not None:
            total_retained_w1 += week_counts[1]
            total_retained_m1 += week_counts[4] if len(week_counts) > 4 else week_counts[min(len(week_counts) - 1, 4)]
        result_cohorts.append({
            "weekStart": cohort_date.isoformat(),
            "signups": len(signup_ids),
            "retainedByWeek": week_counts,
            "retainedWeek1Rate": round(retained_w1, 3) if retained_w1 is not None else None,
            "retainedMonth1Rate": round(retained_m1, 3) if retained_m1 is not None else None,
        })

    latest_week = now.date() - timedelta(days=now.weekday())
    active_last_week = len(active_by_week.get(latest_week, set()))
    return {
        "weeks": weeks,
        "cohorts": result_cohorts,
        "totals": {
            "signups": total_signups,
            "retainedWeek1Rate": round(total_retained_w1 / total_signups, 3) if total_signups else None,
            "retainedMonth1Rate": round(total_retained_m1 / total_signups, 3) if total_signups else None,
            "activeLastWeek": active_last_week,
        },
    }

