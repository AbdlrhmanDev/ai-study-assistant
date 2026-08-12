import smtplib
from datetime import datetime, time, timezone
from email.message import EmailMessage
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select

from ...core.config import get_settings
from ...db.session import get_sessionmaker
from ..flashcards import repository as flashcards_repository
from ..users.model import User
from .model import ReminderDelivery, ReminderPreference


def _send_email(to_email: str, due_cards: int) -> None:
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_from_email:
        raise RuntimeError("SMTP_HOST and SMTP_FROM_EMAIL are required for reminders")
    message = EmailMessage()
    message["Subject"] = f"You have {due_cards} Studia flashcards ready"
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    message.set_content(
        f"A short review keeps your memory strong. You have {due_cards} cards ready.\n\n"
        f"Start reviewing: {settings.app_public_url.rstrip('/')}/flashcards"
    )
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as client:
        if settings.smtp_use_tls:
            client.starttls()
        if settings.smtp_username:
            client.login(settings.smtp_username, settings.smtp_password)
        client.send_message(message)


async def send_due_review_reminders(now: datetime | None = None) -> dict[str, int]:
    now = now or datetime.now(timezone.utc)
    results = {"sent": 0, "failed": 0, "skipped": 0}
    async with get_sessionmaker()() as db:
        rows = await db.execute(
            select(ReminderPreference, User).join(User, User.id == ReminderPreference.user_id)
            .where(ReminderPreference.email_enabled.is_(True))
        )
        for preference, user in rows.all():
            try:
                local_now = now.astimezone(ZoneInfo(preference.timezone))
            except ZoneInfoNotFoundError:
                local_now = now
            if local_now.hour != preference.hour_local:
                continue
            reminder_day = datetime.combine(local_now.date(), time.min, tzinfo=timezone.utc)
            existing = await db.scalar(select(ReminderDelivery.id).where(
                ReminderDelivery.user_id == user.id,
                ReminderDelivery.reminder_date == reminder_day,
            ))
            if existing is not None:
                continue
            due_cards = await flashcards_repository.count_due_for_user(db, user.id, now)
            if due_cards < preference.minimum_due_cards:
                db.add(ReminderDelivery(user_id=user.id, reminder_date=reminder_day, status="skipped", due_cards=due_cards))
                results["skipped"] += 1
                continue
            try:
                await run_in_threadpool(_send_email, user.email, due_cards)
                status, error = "sent", None
                results["sent"] += 1
            except Exception as exc:
                status, error = "failed", str(exc)[:1000]
                results["failed"] += 1
            db.add(ReminderDelivery(user_id=user.id, reminder_date=reminder_day, status=status, due_cards=due_cards, error_message=error))
        await db.commit()
    return results
