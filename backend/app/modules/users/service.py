from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import structlog
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from ...core.exceptions import AppError
from ...core.security import (
    current_session_token_hash,
    destroy_session,
    hash_password,
    verify_password,
)
from ..ai.model import Document
from ..auth import repository as sessions_repository
from ..exams.model import Exam
from ..flashcards.model import Flashcard
from ..notes.model import Note
from ..quizzes.model import Quiz
from ..study_history.model import StudyActivity
from ..topics.model import Topic
from ..usage.model import UsageEvent
from ..workspace.model import WorkspacePage
from . import repository
from .exceptions import (
    EmailAlreadyRegisteredError,
    InvalidCurrentPasswordError,
    SessionNotFoundError,
    UserNotFoundError,
)
from .model import User

logger = structlog.get_logger("study_assistant")

PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
PROFILE_IMAGE_TYPES = {
    "image/jpeg": (b"\xff\xd8\xff", ".jpg"),
    "image/png": (b"\x89PNG\r\n\x1a\n", ".png"),
}


def validate_profile_image(raw_bytes: bytes, content_type: str | None) -> tuple[str, str]:
    if not raw_bytes:
        raise AppError("Choose an image to upload", 400)
    if len(raw_bytes) > PROFILE_IMAGE_MAX_BYTES:
        raise AppError("Profile image must be 5 MB or smaller", 413)
    normalized = (content_type or "").lower().split(";", 1)[0].strip()
    if normalized == "image/webp":
        valid = len(raw_bytes) >= 12 and raw_bytes[:4] == b"RIFF" and raw_bytes[8:12] == b"WEBP"
        extension = ".webp"
    elif normalized in PROFILE_IMAGE_TYPES:
        signature, extension = PROFILE_IMAGE_TYPES[normalized]
        valid = raw_bytes.startswith(signature)
    else:
        valid = False
        extension = ""
    if not valid:
        raise AppError("Upload a valid PNG, JPEG, or WebP image", 400)
    return normalized, extension


def profile_image_url(user: User) -> str | None:
    if not user.profile_image_path:
        return None
    from ..ai.storage import get_storage_backend

    signed_url = get_storage_backend().signed_download_url(user.profile_image_path)
    version = int(user.updated_at.timestamp()) if user.updated_at else 0
    return signed_url or f"/api/v1/users/me/profile-image?v={version}"


def public_user(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "profileImageUrl": profile_image_url(user),
    }


async def register(db: AsyncSession, *, name: str, email: str, password: str) -> User:
    if await repository.get_by_email_ci(db, email) is not None:
        raise EmailAlreadyRegisteredError()

    password_hash = await hash_password(password)
    try:
        user = await repository.create(db, name=name, email=email, password_hash=password_hash)
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise EmailAlreadyRegisteredError() from error
    return user


async def update_profile(
    db: AsyncSession, user_id: int, *, name: str | None, email: str | None
) -> User:
    if email is not None:
        existing = await repository.get_by_email_ci(db, email)
        if existing is not None and existing.id != user_id:
            raise EmailAlreadyRegisteredError()

    try:
        user = await repository.update_profile(db, user_id, name=name, email=email)
        if user is None:
            raise UserNotFoundError()
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise EmailAlreadyRegisteredError() from error
    return user


async def update_profile_image(
    db: AsyncSession, user_id: int, *, raw_bytes: bytes, content_type: str | None
) -> User:
    user = await repository.get_by_id(db, user_id)
    if user is None:
        raise UserNotFoundError()
    normalized_type, extension = validate_profile_image(raw_bytes, content_type)
    old_path = user.profile_image_path
    object_key = f"profile-images/{user_id}/{uuid4().hex}{extension}"

    from ..ai.storage import get_storage_backend

    storage = get_storage_backend()
    new_path = storage.save(object_key, raw_bytes, normalized_type)
    try:
        updated = await repository.set_profile_image(
            db, user_id, storage_path=new_path, content_type=normalized_type
        )
        if updated is None:
            raise UserNotFoundError()
        await db.commit()
    except Exception:
        await db.rollback()
        storage.delete(new_path)
        raise
    if old_path and old_path != new_path:
        try:
            storage.delete(old_path)
        except Exception:
            logger.warning("old_profile_image_delete_failed", user_id=user_id, exc_info=True)
    return updated


async def _require_password_match(db: AsyncSession, user_id: int, password: str) -> User:
    user = await repository.get_by_id(db, user_id)
    if user is None:
        raise UserNotFoundError()
    if not await verify_password(password, user.password_hash):
        raise InvalidCurrentPasswordError()
    return user


async def change_password(
    db: AsyncSession, request: Request, user_id: int, *, current_password: str, new_password: str
) -> dict:
    await _require_password_match(db, user_id, current_password)
    new_hash = await hash_password(new_password)
    await repository.set_password_hash(db, user_id, new_hash)

    current_hash = current_session_token_hash(request)
    revoked = await sessions_repository.delete_all_by_user_except(db, user_id, current_hash)
    await db.commit()
    logger.info("password_changed", user_id=user_id, other_sessions_revoked=revoked)
    return {"otherSessionsRevoked": revoked}


def _humanize_user_agent(user_agent: str | None) -> str:
    if not user_agent:
        return "Unknown device"
    ua = user_agent.lower()
    if "iphone" in ua:
        browser_os = "iPhone"
    elif "ipad" in ua:
        browser_os = "iPad"
    elif "android" in ua:
        browser_os = "Android"
    elif "macintosh" in ua or "mac os" in ua:
        browser_os = "Mac"
    elif "windows" in ua:
        browser_os = "Windows"
    elif "linux" in ua:
        browser_os = "Linux"
    else:
        browser_os = "Unknown device"
    if "edg/" in ua:
        browser = "Edge"
    elif "chrome/" in ua and "chromium" not in ua:
        browser = "Chrome"
    elif "firefox/" in ua:
        browser = "Firefox"
    elif "safari/" in ua and "chrome/" not in ua:
        browser = "Safari"
    else:
        browser = "a browser"
    return f"{browser} on {browser_os}"


async def list_sessions(db: AsyncSession, request: Request, user_id: int) -> list[dict]:
    current_hash = current_session_token_hash(request)
    rows = await sessions_repository.list_active_by_user(db, user_id, datetime.now(timezone.utc))
    return [
        {
            "id": row.id,
            "device": _humanize_user_agent(row.user_agent),
            "ipAddress": row.ip_address,
            "createdAt": row.created_at.isoformat(),
            "lastSeenAt": row.last_seen_at.isoformat() if row.last_seen_at else None,
            "isCurrent": row.id == current_hash,
        }
        for row in rows
    ]


async def revoke_session(db: AsyncSession, user_id: int, session_id: str) -> None:
    owned = await sessions_repository.get_owned(db, session_id, user_id)
    if owned is None:
        raise SessionNotFoundError()
    await sessions_repository.delete_by_hash(db, session_id)
    await db.commit()


async def revoke_other_sessions(db: AsyncSession, request: Request, user_id: int) -> dict:
    current_hash = current_session_token_hash(request)
    revoked = await sessions_repository.delete_all_by_user_except(db, user_id, current_hash)
    await db.commit()
    return {"revokedCount": revoked}


async def _document_storage_paths(db: AsyncSession, user_id: int) -> list[str]:
    result = await db.execute(
        select(Document.storage_path)
        .join(Topic, Topic.id == Document.topic_id)
        .where(Topic.user_id == user_id, Document.storage_path.isnot(None))
    )
    return [path for (path,) in result.all() if path]


async def delete_account(db: AsyncSession, request: Request, user_id: int, *, password: str) -> dict:
    """Retry-safe: storage cleanup (idempotent per-object) happens before
    the DB row delete, so a crash partway through just means the retry
    finds fewer objects left to remove. Once the user row is gone, the
    account is gone -- there's nothing left to retry."""
    await _require_password_match(db, user_id, password)

    from ..ai.storage import get_storage_backend

    user = await repository.get_by_id(db, user_id)
    storage_paths = await _document_storage_paths(db, user_id)
    if user and user.profile_image_path:
        storage_paths.append(user.profile_image_path)
    storage = get_storage_backend()
    deleted_objects = 0
    for path in storage_paths:
        try:
            storage.delete(path)
            deleted_objects += 1
        except Exception:
            logger.warning("account_deletion_storage_delete_failed", user_id=user_id, exc_info=True)

    deleted = await repository.delete(db, user_id)
    if not deleted:
        raise UserNotFoundError()
    await db.commit()
    destroy_session(request)

    logger.info(
        "account_deleted", user_id=user_id, storage_objects_deleted=deleted_objects,
        storage_objects_found=len(storage_paths),
    )
    return {"deleted": True}


async def export_account_data(db: AsyncSession, user_id: int) -> dict:
    """Everything explicitly listed in the Privacy Policy's export
    commitment. Deliberately excludes password_hash, session tokens, and
    provider credentials -- and exports document *metadata* (filename,
    status, timestamps), not the file bytes themselves, which belong in a
    download rather than a JSON export."""
    user = await repository.get_by_id(db, user_id)
    if user is None:
        raise UserNotFoundError()

    topics = (await db.execute(select(Topic).where(Topic.user_id == user_id))).scalars().all()
    topic_ids = [topic.id for topic in topics]

    notes = []
    documents = []
    workspace_pages = []
    quizzes = []
    exams = []
    flashcards = []
    if topic_ids:
        notes = (await db.execute(select(Note).where(Note.topic_id.in_(topic_ids)))).scalars().all()
        documents = (
            await db.execute(select(Document).where(Document.topic_id.in_(topic_ids)))
        ).scalars().all()
        quizzes = (await db.execute(select(Quiz).where(Quiz.topic_id.in_(topic_ids)))).scalars().all()
        exams = (await db.execute(select(Exam).where(Exam.topic_id.in_(topic_ids)))).scalars().all()
        flashcards = (
            await db.execute(select(Flashcard).where(Flashcard.topic_id.in_(topic_ids)))
        ).scalars().all()

    workspace_pages = (
        await db.execute(select(WorkspacePage).where(WorkspacePage.user_id == user_id))
    ).scalars().all()
    history = (
        await db.execute(
            select(StudyActivity).where(StudyActivity.user_id == user_id).order_by(StudyActivity.created_at.desc())
        )
    ).scalars().all()
    usage_events = (
        await db.execute(select(UsageEvent).where(UsageEvent.user_id == user_id))
    ).scalars().all()

    return {
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "account": {
            "id": user.id, "name": user.name, "email": user.email,
            "createdAt": user.created_at.isoformat(),
        },
        "topics": [
            {"id": t.id, "title": t.title, "description": t.description, "createdAt": t.created_at.isoformat()}
            for t in topics
        ],
        "notes": [
            {
                "id": n.id, "topicId": n.topic_id, "title": n.title, "content": n.content,
                "createdAt": n.created_at.isoformat(), "updatedAt": n.updated_at.isoformat(),
            }
            for n in notes
        ],
        "documents": [
            {
                "id": d.id, "topicId": d.topic_id, "title": d.title, "originalFilename": d.original_filename,
                "contentType": d.content_type, "status": d.status, "createdAt": d.created_at.isoformat(),
            }
            for d in documents
        ],
        "workspacePages": [
            {"id": p.id, "topicId": p.topic_id, "title": p.title, "updatedAt": p.updated_at.isoformat()}
            for p in workspace_pages
        ],
        "quizzes": [
            {"id": q.id, "topicId": q.topic_id, "title": q.title, "createdAt": q.created_at.isoformat()}
            for q in quizzes
        ],
        "exams": [
            {"id": e.id, "topicId": e.topic_id, "title": e.title, "createdAt": e.created_at.isoformat()}
            for e in exams
        ],
        "flashcards": [
            {"id": f.id, "topicId": f.topic_id, "question": f.question, "answer": f.answer, "status": f.status}
            for f in flashcards
        ],
        "studyHistory": [
            {
                "id": h.id, "topicId": h.topic_id, "activityType": h.activity_type,
                "description": h.description, "createdAt": h.created_at.isoformat(),
            }
            for h in history
        ],
        "aiUsageSummary": {
            "totalEvents": len(usage_events),
            "byFeature": {
                feature: sum(1 for e in usage_events if e.feature == feature)
                for feature in {e.feature for e in usage_events}
            },
        },
    }
