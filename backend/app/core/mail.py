"""Generic transactional email sending, shared by every feature that emails a
user (flashcard review reminders, email verification, password reset).

Backed by SMTP via stdlib `smtplib` -- no third-party mail provider is
configured yet (see PRODUCTION.md), matching the rest of this app's
Redis-optional/provider-optional philosophy: sending is a no-op-with-a-clear-
error when SMTP isn't configured, rather than a hard dependency.
"""

from email.message import EmailMessage

from fastapi.concurrency import run_in_threadpool

from .config import get_settings


def send_email_sync(to_email: str, subject: str, body: str) -> None:
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_from_email:
        raise RuntimeError("SMTP_HOST and SMTP_FROM_EMAIL are required to send email")
    import smtplib

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    message.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as client:
        if settings.smtp_use_tls:
            client.starttls()
        if settings.smtp_username:
            client.login(settings.smtp_username, settings.smtp_password)
        client.send_message(message)


async def send_email(to_email: str, subject: str, body: str) -> None:
    await run_in_threadpool(send_email_sync, to_email, subject, body)
