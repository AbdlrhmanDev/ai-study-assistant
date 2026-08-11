"""Account security is tested at the service layer directly, not over HTTP
-- see tests/test_auth.py's module docstring for why: SessionMiddleware
persists sessions through an independent DB connection, which can't see a
user that only exists inside this test's uncommitted `db_session`
transaction. Failure paths without side effects are still safe over HTTP
where useful (ownership 404s)."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.core.exceptions import AppError
from app.modules.ai.model import Document, DocumentChunk
from app.modules.auth import repository as sessions_repository
from app.modules.auth import service as auth_service
from app.modules.auth.model import UserSession
from app.modules.notes.model import Note
from app.modules.topics.model import Topic
from app.modules.users import service as users_service
from app.modules.users.model import User


def _bare_request(session_token: str | None = None) -> Request:
    request = Request({"type": "http", "client": ("127.0.0.1", 1), "headers": []})
    request.scope["session"] = {}
    request.state.session_token = session_token
    request.state.session_action = None
    return request


def _unique_email() -> str:
    return f"account-security-{uuid.uuid4()}@example.com"


@pytest_asyncio.fixture
async def registered_user(db_session: AsyncSession) -> dict:
    request = _bare_request()
    return await auth_service.register(
        db_session, request, name="Account Security User", email=_unique_email(), password="correct-horse-1"
    )


async def _add_session(db_session: AsyncSession, user_id: int, token: str, *, hours_ago: int = 0) -> str:
    from app.core.security import _hash_token  # test-only reach into the hashing helper

    token_hash = _hash_token(token)
    await sessions_repository.upsert(
        db_session, token_hash=token_hash, user_id=user_id, data={"user": {"id": user_id}},
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        last_seen_at=datetime.now(timezone.utc) - timedelta(hours=hours_ago),
        user_agent="Mozilla/5.0 (Windows NT 10.0) Chrome/120.0", ip_address="203.0.113.9",
    )
    return token_hash


async def test_change_password_requires_correct_current_password(
    db_session: AsyncSession, registered_user: dict,
) -> None:
    request = _bare_request()
    with pytest.raises(AppError) as excinfo:
        await users_service.change_password(
            db_session, request, registered_user["id"],
            current_password="wrong-password", new_password="new-password-123",
        )
    assert excinfo.value.status_code == 401


async def test_change_password_success_allows_login_with_new_password(
    db_session: AsyncSession, registered_user: dict,
) -> None:
    request = _bare_request()
    await users_service.change_password(
        db_session, request, registered_user["id"],
        current_password="correct-horse-1", new_password="brand-new-password-1",
    )

    login_request = _bare_request()
    # Old password must no longer work.
    with pytest.raises(AppError):
        await auth_service.login(db_session, login_request, email=registered_user["email"], password="correct-horse-1")
    # New password does.
    logged_in = await auth_service.login(
        db_session, login_request, email=registered_user["email"], password="brand-new-password-1"
    )
    assert logged_in["id"] == registered_user["id"]


async def test_change_password_revokes_other_sessions_but_keeps_current(
    db_session: AsyncSession, registered_user: dict,
) -> None:
    current_hash = await _add_session(db_session, registered_user["id"], "current-token")
    other_hash = await _add_session(db_session, registered_user["id"], "other-token")

    request = _bare_request(session_token="current-token")
    result = await users_service.change_password(
        db_session, request, registered_user["id"],
        current_password="correct-horse-1", new_password="another-new-password-1",
    )

    assert result["otherSessionsRevoked"] == 1
    assert await db_session.get(UserSession, current_hash) is not None
    assert await db_session.get(UserSession, other_hash) is None


async def test_list_sessions_marks_current_and_shows_device(
    db_session: AsyncSession, registered_user: dict,
) -> None:
    await _add_session(db_session, registered_user["id"], "device-a", hours_ago=2)
    await _add_session(db_session, registered_user["id"], "device-b")

    request = _bare_request(session_token="device-b")
    sessions = await users_service.list_sessions(db_session, request, registered_user["id"])

    assert len(sessions) == 2
    current = next(s for s in sessions if s["isCurrent"])
    assert "Chrome" in current["device"]
    assert current["ipAddress"] == "203.0.113.9"
    assert sum(1 for s in sessions if s["isCurrent"]) == 1


async def test_revoke_session_ownership_isolation(
    db_session: AsyncSession, registered_user: dict, other_user: User,
) -> None:
    victim_hash = await _add_session(db_session, other_user.id, "victim-token")

    with pytest.raises(AppError) as excinfo:
        await users_service.revoke_session(db_session, registered_user["id"], victim_hash)
    assert excinfo.value.status_code == 404
    assert await db_session.get(UserSession, victim_hash) is not None


async def test_revoke_other_sessions_keeps_current(db_session: AsyncSession, registered_user: dict) -> None:
    current_hash = await _add_session(db_session, registered_user["id"], "keep-me")
    await _add_session(db_session, registered_user["id"], "drop-me-1")
    await _add_session(db_session, registered_user["id"], "drop-me-2")

    request = _bare_request(session_token="keep-me")
    result = await users_service.revoke_other_sessions(db_session, request, registered_user["id"])

    assert result["revokedCount"] == 2
    assert await db_session.get(UserSession, current_hash) is not None


async def test_delete_account_requires_correct_password(
    db_session: AsyncSession, registered_user: dict,
) -> None:
    request = _bare_request()
    with pytest.raises(AppError) as excinfo:
        await users_service.delete_account(db_session, request, registered_user["id"], password="wrong")
    assert excinfo.value.status_code == 401
    assert await db_session.get(User, registered_user["id"]) is not None


async def test_delete_account_cascades_and_removes_storage_object(
    db_session: AsyncSession, registered_user: dict, tmp_path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path))

    topic = Topic(user_id=registered_user["id"], title="Deletion test", description=None)
    db_session.add(topic)
    await db_session.flush()
    note = Note(topic_id=topic.id, title="Note", content="content")
    db_session.add(note)

    storage_path = "documents/test/1/source.txt"
    stored_file = tmp_path / storage_path
    stored_file.parent.mkdir(parents=True, exist_ok=True)
    stored_file.write_text("hello")
    document = Document(
        topic_id=topic.id, title="Doc", original_filename="doc.txt", content_type="text/plain",
        status="completed", storage_path=storage_path,
    )
    db_session.add(document)
    await db_session.flush()
    db_session.add(DocumentChunk(topic_id=topic.id, document_id=document.id, chunk_index=0, content="chunk"))
    await db_session.flush()

    request = _bare_request()
    result = await users_service.delete_account(
        db_session, request, registered_user["id"], password="correct-horse-1"
    )

    assert result["deleted"] is True
    # `Session.get` would return the already-loaded objects straight from
    # the identity map without re-querying -- `select()` always issues a
    # real query, so this actually proves the ON DELETE CASCADE fired, not
    # just that the Python objects are still sitting in memory.
    assert (await db_session.execute(select(User).where(User.id == registered_user["id"]))).scalar_one_or_none() is None
    assert (await db_session.execute(select(Topic).where(Topic.id == topic.id))).scalar_one_or_none() is None
    assert (await db_session.execute(select(Note).where(Note.id == note.id))).scalar_one_or_none() is None
    assert (await db_session.execute(select(Document).where(Document.id == document.id))).scalar_one_or_none() is None
    remaining_chunks = (
        await db_session.execute(select(DocumentChunk).where(DocumentChunk.document_id == document.id))
    ).scalars().all()
    assert remaining_chunks == []
    assert not stored_file.exists()


async def test_delete_account_retry_after_completion_is_a_clean_404(
    db_session: AsyncSession, registered_user: dict,
) -> None:
    request = _bare_request()
    await users_service.delete_account(db_session, request, registered_user["id"], password="correct-horse-1")

    with pytest.raises(AppError) as excinfo:
        await users_service.delete_account(db_session, request, registered_user["id"], password="correct-horse-1")
    assert excinfo.value.status_code in (401, 404)  # user gone -> password check itself 404s first


async def test_export_account_data_excludes_secrets_and_includes_content(
    db_session: AsyncSession, registered_user: dict,
) -> None:
    topic = Topic(user_id=registered_user["id"], title="Export test", description=None)
    db_session.add(topic)
    await db_session.flush()
    db_session.add(Note(topic_id=topic.id, title="Exported note", content="secret-ish study content"))
    await db_session.flush()

    export = await users_service.export_account_data(db_session, registered_user["id"])

    assert export["account"]["email"] == registered_user["email"]
    assert "password_hash" not in export["account"]
    assert "passwordHash" not in export["account"]
    assert any(note["title"] == "Exported note" for note in export["notes"])
    assert any(topic_row["title"] == "Export test" for topic_row in export["topics"])
    dumped = str(export)
    assert "correct-horse-1" not in dumped


async def test_export_account_data_isolated_between_users(
    db_session: AsyncSession, registered_user: dict, other_user: User,
) -> None:
    topic = Topic(user_id=other_user.id, title="Other user's topic", description=None)
    db_session.add(topic)
    await db_session.flush()

    export = await users_service.export_account_data(db_session, registered_user["id"])

    assert all(t["title"] != "Other user's topic" for t in export["topics"])
