from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.modules.ai import cleanup, indexing
from app.modules.ai.model import Document
from app.modules.topics.model import Topic
from app.modules.users.model import User

pytestmark = pytest.mark.smoke


@pytest.fixture(autouse=True)
def _local_storage(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path))
    return tmp_path


@pytest.fixture(autouse=True)
def _no_background_indexing(monkeypatch: pytest.MonkeyPatch):
    """Document CRUD tests don't need real text extraction/embedding --
    stub the enqueue call so no provider network call happens."""
    async def _noop(document_id: int) -> str:
        return "test-noop"

    monkeypatch.setattr(indexing, "enqueue_document_index", _noop)


async def _make_topic(db_session: AsyncSession, user: User) -> Topic:
    topic = Topic(user_id=user.id, title="Document smoke test", description=None)
    db_session.add(topic)
    await db_session.flush()
    return topic


async def test_upload_list_and_delete_document(
    authed_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    tmp_path: Path,
) -> None:
    topic = await _make_topic(db_session, test_user)

    upload = await authed_client.post(
        f"/api/v1/topics/{topic.id}/documents",
        files={"file": ("lesson.txt", b"A concise lesson for indexing.", "text/plain")},
    )
    assert upload.status_code == 202, upload.text
    document = upload.json()["document"]
    assert document["status"] == "pending"
    stored_file = tmp_path / "documents" / str(test_user.id) / str(document["id"]) / "source.txt"
    assert stored_file.exists()

    listed = await authed_client.get(f"/api/v1/topics/{topic.id}/documents")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()["documents"]] == [document["id"]]

    deleted = await authed_client.delete(f"/api/v1/documents/{document['id']}")
    assert deleted.status_code == 204
    assert not stored_file.exists()

    # A second delete of the same (now-gone) document is a normal 404, not a
    # storage-layer crash -- confirms the delete path degrades safely.
    deleted_again = await authed_client.delete(f"/api/v1/documents/{document['id']}")
    assert deleted_again.status_code == 404


async def test_delete_document_succeeds_even_if_storage_object_already_gone(
    authed_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    tmp_path: Path,
) -> None:
    """Simulates a retried delete after the storage object was already
    removed out-of-band -- the DB row must still be cleaned up, not error."""
    topic = await _make_topic(db_session, test_user)
    upload = await authed_client.post(
        f"/api/v1/topics/{topic.id}/documents",
        files={"file": ("notes.txt", b"content", "text/plain")},
    )
    document_id = upload.json()["document"]["id"]
    stored_file = tmp_path / "documents" / str(test_user.id) / str(document_id) / "source.txt"
    stored_file.unlink()  # object already gone, out-of-band

    deleted = await authed_client.delete(f"/api/v1/documents/{document_id}")
    assert deleted.status_code == 204

    remaining = await db_session.get(Document, document_id)
    assert remaining is None


async def test_upload_rejects_mismatched_extension_and_stores_nothing(
    authed_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    tmp_path: Path,
) -> None:
    topic = await _make_topic(db_session, test_user)
    upload = await authed_client.post(
        f"/api/v1/topics/{topic.id}/documents",
        files={"file": ("payload.exe", b"MZ\x90\x00 not a real pdf or text file", "text/plain")},
    )
    assert upload.status_code == 415, upload.text

    listed = await authed_client.get(f"/api/v1/topics/{topic.id}/documents")
    assert listed.json()["documents"] == []
    documents_dir = tmp_path / "documents"
    assert not documents_dir.exists() or not any(documents_dir.glob("**/*"))


async def test_retry_document_resets_status_and_reindexes(
    authed_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
) -> None:
    topic = await _make_topic(db_session, test_user)
    upload = await authed_client.post(
        f"/api/v1/topics/{topic.id}/documents",
        files={"file": ("lesson.txt", b"content", "text/plain")},
    )
    document_id = upload.json()["document"]["id"]
    await db_session.execute(
        Document.__table__.update().where(Document.id == document_id).values(
            status="failed", error_message="boom"
        )
    )
    await db_session.commit()

    retried = await authed_client.post(f"/api/v1/documents/{document_id}/retry")
    assert retried.status_code == 202, retried.text
    assert retried.json()["document"]["status"] == "pending"


async def test_document_preview_returns_extracted_text_once_completed(
    authed_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
) -> None:
    topic = await _make_topic(db_session, test_user)
    upload = await authed_client.post(
        f"/api/v1/topics/{topic.id}/documents",
        files={"file": ("lesson.txt", b"content", "text/plain")},
    )
    document_id = upload.json()["document"]["id"]
    await db_session.execute(
        Document.__table__.update().where(Document.id == document_id).values(
            status="completed", extracted_text="The mitochondria is the powerhouse of the cell."
        )
    )
    await db_session.commit()

    response = await authed_client.get(f"/api/v1/documents/{document_id}/preview")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["text"] == "The mitochondria is the powerhouse of the cell."
    assert body["truncated"] is False


async def test_document_preview_is_null_while_still_processing(
    authed_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
) -> None:
    topic = await _make_topic(db_session, test_user)
    upload = await authed_client.post(
        f"/api/v1/topics/{topic.id}/documents",
        files={"file": ("lesson.txt", b"content", "text/plain")},
    )
    document_id = upload.json()["document"]["id"]

    response = await authed_client.get(f"/api/v1/documents/{document_id}/preview")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "pending"
    assert body["text"] is None


async def test_document_preview_truncates_very_long_extracted_text(
    authed_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
) -> None:
    topic = await _make_topic(db_session, test_user)
    upload = await authed_client.post(
        f"/api/v1/topics/{topic.id}/documents",
        files={"file": ("lesson.txt", b"content", "text/plain")},
    )
    document_id = upload.json()["document"]["id"]
    long_text = "word " * 10_000
    await db_session.execute(
        Document.__table__.update().where(Document.id == document_id).values(
            status="completed", extracted_text=long_text
        )
    )
    await db_session.commit()

    response = await authed_client.get(f"/api/v1/documents/{document_id}/preview")

    assert response.status_code == 200
    body = response.json()
    assert body["truncated"] is True
    assert len(body["text"]) == 20_000


async def test_document_preview_for_unowned_document_returns_404(
    authed_client: AsyncClient,
    db_session: AsyncSession,
    other_user: User,
) -> None:
    topic = await _make_topic(db_session, other_user)
    document = Document(
        topic_id=topic.id, title="Other user's doc", original_filename="x.txt",
        content_type="text/plain", status="completed", extracted_text="secret",
    )
    db_session.add(document)
    await db_session.flush()

    response = await authed_client.get(f"/api/v1/documents/{document.id}/preview")

    assert response.status_code == 404


async def test_download_url_unavailable_for_local_backend(
    authed_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
) -> None:
    topic = await _make_topic(db_session, test_user)
    upload = await authed_client.post(
        f"/api/v1/topics/{topic.id}/documents",
        files={"file": ("lesson.txt", b"content", "text/plain")},
    )
    document_id = upload.json()["document"]["id"]

    response = await authed_client.get(f"/api/v1/documents/{document_id}/download-url")
    assert response.status_code == 409


async def test_storage_usage_reports_used_and_limit_bytes(
    authed_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
) -> None:
    topic = await _make_topic(db_session, test_user)
    content = b"x" * 1000
    await authed_client.post(
        f"/api/v1/topics/{topic.id}/documents",
        files={"file": ("a.txt", content, "text/plain")},
    )

    response = await authed_client.get("/api/v1/documents/storage-usage")

    assert response.status_code == 200
    body = response.json()
    assert body["usedBytes"] == len(content)
    assert body["limitBytes"] == get_settings().max_storage_bytes_per_user


async def test_storage_usage_sums_across_all_of_a_users_topics(
    authed_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
) -> None:
    topic_a = await _make_topic(db_session, test_user)
    topic_b = await _make_topic(db_session, test_user)
    await authed_client.post(
        f"/api/v1/topics/{topic_a.id}/documents",
        files={"file": ("a.txt", b"x" * 500, "text/plain")},
    )
    await authed_client.post(
        f"/api/v1/topics/{topic_b.id}/documents",
        files={"file": ("b.txt", b"y" * 700, "text/plain")},
    )

    response = await authed_client.get("/api/v1/documents/storage-usage")

    assert response.json()["usedBytes"] == 1200


async def test_upload_rejected_when_it_would_exceed_storage_quota(
    authed_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(get_settings(), "max_storage_mb_per_user", 1)
    topic = await _make_topic(db_session, test_user)
    oversized = b"x" * (2 * 1024 * 1024)

    upload = await authed_client.post(
        f"/api/v1/topics/{topic.id}/documents",
        files={"file": ("big.txt", oversized, "text/plain")},
    )

    assert upload.status_code == 413, upload.text
    assert "storage limit" in upload.json()["message"].lower()

    listed = await authed_client.get(f"/api/v1/topics/{topic.id}/documents")
    assert listed.json()["documents"] == []


async def test_sweep_abandoned_uploads_fails_stuck_documents_idempotently(
    db_session: AsyncSession, test_user: User,
) -> None:
    topic = await _make_topic(db_session, test_user)
    stuck = Document(
        topic_id=topic.id, title="stuck", original_filename="stuck.txt",
        content_type="text/plain", status="processing",
    )
    db_session.add(stuck)
    await db_session.flush()
    # Backdate creation so it's older than the abandoned-upload threshold.
    await db_session.execute(
        Document.__table__.update().where(Document.id == stuck.id).values(
            created_at=text("now() - interval '2 days'")
        )
    )
    await db_session.commit()

    first_pass = await cleanup.sweep_abandoned_uploads(db_session)
    assert first_pass["failedCount"] == 1

    await db_session.refresh(stuck)
    assert stuck.status == "failed"

    # Re-running is a no-op: the document is no longer pending/processing.
    second_pass = await cleanup.sweep_abandoned_uploads(db_session)
    assert second_pass["failedCount"] == 0
