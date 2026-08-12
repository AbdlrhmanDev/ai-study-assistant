import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.ai import repository as ai_repository
from app.modules.ai.indexing import _flatten_block_text
from app.modules.topics.model import Topic
from app.modules.users.model import User
from app.modules.workspace import service as workspace_service
from app.modules.workspace.model import WorkspacePage


async def _create_topic(db_session: AsyncSession, user: User, title: str = "Topic") -> Topic:
    topic = Topic(user_id=user.id, title=title, description=None)
    db_session.add(topic)
    await db_session.flush()
    return topic


async def _create_page(
    db_session: AsyncSession, user: User, title: str = "Page", topic_id: int | None = None
) -> WorkspacePage:
    page = WorkspacePage(user_id=user.id, title=title, topic_id=topic_id, blocks=[])
    db_session.add(page)
    await db_session.flush()
    return page


async def test_create_page_returns_201(authed_client: AsyncClient):
    response = await authed_client.post("/api/v1/workspace-pages", json={"title": "My Page"})

    assert response.status_code == 201
    body = response.json()["page"]
    assert body["title"] == "My Page"
    assert body["topic_id"] is None
    assert body["blocks"] == []


async def test_create_page_rejects_empty_title(authed_client: AsyncClient):
    response = await authed_client.post("/api/v1/workspace-pages", json={"title": ""})

    assert response.status_code == 422


async def test_create_page_linked_to_owned_topic(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)

    response = await authed_client.post(
        "/api/v1/workspace-pages", json={"title": "Linked Page", "topic_id": topic.id}
    )

    assert response.status_code == 201
    assert response.json()["page"]["topic_id"] == topic.id


async def test_create_page_linked_to_unowned_topic_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
):
    topic = await _create_topic(db_session, other_user)

    response = await authed_client.post(
        "/api/v1/workspace-pages", json={"title": "Nope", "topic_id": topic.id}
    )

    assert response.status_code == 404


async def test_list_pages_returns_owned_pages(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, other_user: User
):
    await _create_page(db_session, test_user, "Mine")
    await _create_page(db_session, other_user, "Not mine")

    response = await authed_client.get("/api/v1/workspace-pages")

    assert response.status_code == 200
    titles = {page["title"] for page in response.json()["pages"]}
    assert titles == {"Mine"}


async def test_list_pages_filters_by_topic(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)
    await _create_page(db_session, test_user, "Linked", topic_id=topic.id)
    await _create_page(db_session, test_user, "Standalone")

    response = await authed_client.get(f"/api/v1/workspace-pages?topic_id={topic.id}")

    assert response.status_code == 200
    titles = [page["title"] for page in response.json()["pages"]]
    assert titles == ["Linked"]


async def test_get_page_not_owned_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
):
    page = await _create_page(db_session, other_user)

    response = await authed_client.get(f"/api/v1/workspace-pages/{page.id}")

    assert response.status_code == 404


async def test_update_page_blocks(authed_client: AsyncClient, db_session: AsyncSession, test_user: User):
    page = await _create_page(db_session, test_user)
    blocks = [
        {"id": "b1", "type": "heading_1", "content": "Section one"},
        {"id": "b2", "type": "text", "content": "Some notes"},
        {
            "id": "b3",
            "type": "todo",
            "content": "Read chapter 1",
            "properties": {"checked": True},
        },
        {
            "id": "b4",
            "type": "bookmark",
            "properties": {"url": "https://example.com", "title": "Example resource"},
        },
    ]

    response = await authed_client.patch(f"/api/v1/workspace-pages/{page.id}", json={"blocks": blocks})

    assert response.status_code == 200
    body = response.json()["page"]
    assert len(body["blocks"]) == 4
    assert body["blocks"][2]["properties"]["checked"] is True
    assert body["blocks"][3]["properties"]["url"] == "https://example.com"


async def test_update_page_blocks_supports_nested_children(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    page = await _create_page(db_session, test_user)
    blocks = [
        {
            "id": "b1",
            "type": "toggle",
            "content": "Details",
            "children": [
                {"id": "b1a", "type": "text", "content": "Nested note"},
                {
                    "id": "b1b",
                    "type": "bulleted_list_item",
                    "content": "Nested item",
                    "children": [{"id": "b1b1", "type": "text", "content": "Deeper still"}],
                },
            ],
        },
    ]

    response = await authed_client.patch(f"/api/v1/workspace-pages/{page.id}", json={"blocks": blocks})

    assert response.status_code == 200
    body = response.json()["page"]["blocks"]
    assert body[0]["children"][0]["content"] == "Nested note"
    assert body[0]["children"][1]["children"][0]["content"] == "Deeper still"


async def test_update_page_rejects_unknown_block_type(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    page = await _create_page(db_session, test_user)

    response = await authed_client.patch(
        f"/api/v1/workspace-pages/{page.id}",
        json={"blocks": [{"id": "b1", "type": "nonexistent_type", "content": "nope"}]},
    )

    assert response.status_code == 422


async def test_update_page_rejects_blocks_nested_too_deep(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    page = await _create_page(db_session, test_user)

    block: dict = {"id": "b0", "type": "text", "content": "leaf"}
    for depth in range(10):
        block = {"id": f"b{depth + 1}", "type": "toggle", "content": "wrap", "children": [block]}

    response = await authed_client.patch(f"/api/v1/workspace-pages/{page.id}", json={"blocks": [block]})

    assert response.status_code == 422


async def test_update_page_rejects_empty_payload(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    page = await _create_page(db_session, test_user)

    response = await authed_client.patch(f"/api/v1/workspace-pages/{page.id}", json={})

    assert response.status_code == 422


async def test_link_page_to_topic(authed_client: AsyncClient, db_session: AsyncSession, test_user: User):
    page = await _create_page(db_session, test_user)
    topic = await _create_topic(db_session, test_user)

    response = await authed_client.patch(
        f"/api/v1/workspace-pages/{page.id}/topic", json={"topic_id": topic.id}
    )

    assert response.status_code == 200
    assert response.json()["page"]["topic_id"] == topic.id


async def test_unlink_page_from_topic(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    topic = await _create_topic(db_session, test_user)
    page = await _create_page(db_session, test_user, topic_id=topic.id)

    response = await authed_client.patch(
        f"/api/v1/workspace-pages/{page.id}/topic", json={"topic_id": None}
    )

    assert response.status_code == 200
    assert response.json()["page"]["topic_id"] is None


async def test_delete_page_removes_it(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    page = await _create_page(db_session, test_user)

    delete_response = await authed_client.delete(f"/api/v1/workspace-pages/{page.id}")
    assert delete_response.status_code == 204

    get_response = await authed_client.get(f"/api/v1/workspace-pages/{page.id}")
    assert get_response.status_code == 404


async def test_ask_ai_on_block_returns_answer(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate("Here's a clearer version of that note.")
    page = await _create_page(db_session, test_user)
    await authed_client.patch(
        f"/api/v1/workspace-pages/{page.id}",
        json={"blocks": [{"id": "b1", "type": "text", "content": "some rough notes"}]},
    )

    response = await authed_client.post(
        f"/api/v1/workspace-pages/{page.id}/blocks/b1/ask-ai",
        json={"instruction": "Rewrite this more clearly"},
    )

    assert response.status_code == 200
    result = response.json()["result"]
    assert result["answer"] == "Here's a clearer version of that note."
    assert result["provider"] == "mock"


async def test_ask_ai_on_unknown_block_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate("unused")
    page = await _create_page(db_session, test_user)

    response = await authed_client.post(
        f"/api/v1/workspace-pages/{page.id}/blocks/nonexistent/ask-ai",
        json={"instruction": "Explain this"},
    )

    assert response.status_code == 404


async def test_ask_ai_on_block_not_owned_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User, mock_ai_generate
):
    mock_ai_generate("unused")
    page = await _create_page(db_session, other_user)

    response = await authed_client.post(
        f"/api/v1/workspace-pages/{page.id}/blocks/b1/ask-ai",
        json={"instruction": "Explain this"},
    )

    assert response.status_code == 404


async def test_ask_ai_rejects_empty_instruction(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    page = await _create_page(db_session, test_user)

    response = await authed_client.post(
        f"/api/v1/workspace-pages/{page.id}/blocks/b1/ask-ai",
        json={"instruction": ""},
    )

    assert response.status_code == 422


async def test_update_page_without_expected_updated_at_always_overwrites(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User,
):
    """Existing/older clients that never send expectedUpdatedAt keep their
    current always-wins behavior -- the guard is opt-in."""
    page = await _create_page(db_session, test_user, title="Original")

    first = await authed_client.patch(f"/api/v1/workspace-pages/{page.id}", json={"title": "Tab A edit"})
    assert first.status_code == 200
    second = await authed_client.patch(f"/api/v1/workspace-pages/{page.id}", json={"title": "Tab B edit"})
    assert second.status_code == 200
    assert second.json()["page"]["title"] == "Tab B edit"


async def test_update_page_with_stale_expected_updated_at_returns_conflict(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User,
):
    """Simulates a second tab having saved in between: rather than relying
    on wall-clock time actually advancing (Postgres's `now()` is frozen for
    the whole test -- it's one outer transaction), directly backdate
    updated_at the way a real prior save would have left it different from
    what a stale client still holds."""
    from datetime import timedelta

    page = await _create_page(db_session, test_user, title="Original")
    stale_updated_at = page.updated_at.isoformat()
    # Mutate the already-identity-mapped ORM object directly, not a raw
    # Core UPDATE -- a Core-style bulk update bypasses the identity map, so
    # this same session's later ORM reads of `page` (via the request below)
    # would keep returning the stale cached object instead of picking up
    # the new value, defeating the point of this test.
    page.title = "Saved from another tab"
    page.updated_at = page.updated_at + timedelta(seconds=5)
    await db_session.commit()

    conflicting_save = await authed_client.patch(
        f"/api/v1/workspace-pages/{page.id}",
        json={"title": "Saved from the stale tab", "expectedUpdatedAt": stale_updated_at},
    )

    assert conflicting_save.status_code == 409
    body = conflicting_save.json()
    assert body["details"]["code"] == "WORKSPACE_PAGE_CONFLICT"
    assert body["details"]["current"]["title"] == "Saved from another tab"

    # The conflicting write must not have applied.
    unchanged = await authed_client.get(f"/api/v1/workspace-pages/{page.id}")
    assert unchanged.json()["page"]["title"] == "Saved from another tab"


async def test_update_page_with_current_expected_updated_at_succeeds(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User,
):
    page = await _create_page(db_session, test_user, title="Original")
    loaded = await authed_client.get(f"/api/v1/workspace-pages/{page.id}")
    current_updated_at = loaded.json()["page"]["updated_at"]

    response = await authed_client.patch(
        f"/api/v1/workspace-pages/{page.id}",
        json={"title": "Up to date save", "expectedUpdatedAt": current_updated_at},
    )

    assert response.status_code == 200
    assert response.json()["page"]["title"] == "Up to date save"


# --------------------------------------------------------------------------
# Version history / recovery snapshots
# --------------------------------------------------------------------------


async def test_first_block_edit_snapshots_the_prior_state(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    page = await _create_page(db_session, test_user, title="Original")

    response = await authed_client.patch(
        f"/api/v1/workspace-pages/{page.id}",
        json={"blocks": [{"id": "b1", "type": "text", "content": "New content"}]},
    )
    assert response.status_code == 200

    versions_response = await authed_client.get(f"/api/v1/workspace-pages/{page.id}/versions")
    assert versions_response.status_code == 200
    versions = versions_response.json()["versions"]
    assert len(versions) == 1
    assert versions[0]["title"] == "Original"


async def test_rapid_edits_within_the_snapshot_window_do_not_pile_up_versions(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    page = await _create_page(db_session, test_user)

    await authed_client.patch(
        f"/api/v1/workspace-pages/{page.id}", json={"blocks": [{"id": "b1", "type": "text", "content": "v1"}]}
    )
    await authed_client.patch(
        f"/api/v1/workspace-pages/{page.id}", json={"blocks": [{"id": "b1", "type": "text", "content": "v2"}]}
    )

    versions_response = await authed_client.get(f"/api/v1/workspace-pages/{page.id}/versions")
    assert len(versions_response.json()["versions"]) == 1


async def test_restore_version_reverts_content_and_snapshots_current_state(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    page = await _create_page(db_session, test_user, title="Original")
    await authed_client.patch(
        f"/api/v1/workspace-pages/{page.id}",
        json={"blocks": [{"id": "b1", "type": "text", "content": "Edited content"}]},
    )
    versions = (await authed_client.get(f"/api/v1/workspace-pages/{page.id}/versions")).json()["versions"]
    version_id = versions[0]["id"]

    response = await authed_client.post(f"/api/v1/workspace-pages/{page.id}/versions/{version_id}/restore")

    assert response.status_code == 200, response.text
    assert response.json()["page"]["blocks"] == []

    versions_after = (await authed_client.get(f"/api/v1/workspace-pages/{page.id}/versions")).json()["versions"]
    assert len(versions_after) == 2


async def test_get_version_returns_full_blocks(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    page = await _create_page(db_session, test_user)
    blocks = [{"id": "b1", "type": "text", "content": "Snapshot me"}]
    await authed_client.patch(f"/api/v1/workspace-pages/{page.id}", json={"blocks": blocks})
    await authed_client.patch(f"/api/v1/workspace-pages/{page.id}", json={"blocks": []})
    version_id = (await authed_client.get(f"/api/v1/workspace-pages/{page.id}/versions")).json()["versions"][0]["id"]

    response = await authed_client.get(f"/api/v1/workspace-pages/{page.id}/versions/{version_id}")

    assert response.status_code == 200
    assert response.json()["version"]["blocks"] == []


async def test_restore_unknown_version_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User
):
    page = await _create_page(db_session, test_user)

    response = await authed_client.post(f"/api/v1/workspace-pages/{page.id}/versions/999999/restore")

    assert response.status_code == 404


async def test_list_versions_for_unowned_page_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
):
    page = await _create_page(db_session, other_user)

    response = await authed_client.get(f"/api/v1/workspace-pages/{page.id}/versions")

    assert response.status_code == 404


# --------------------------------------------------------------------------
# RAG indexing wiring -- topic-linked pages should feed retrieval; unlinked
# pages should not. The actual chunk/embed pipeline runs in an independent
# DB session (see ai/indexing.py), so these tests verify the two halves
# separately: that the service layer *calls* the indexer at the right times,
# and that the chunk-storage/retrieval plumbing itself works correctly.
# --------------------------------------------------------------------------


async def test_update_page_triggers_workspace_indexing(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, monkeypatch: pytest.MonkeyPatch
):
    calls = []

    async def _fake_enqueue(workspace_page_id: int) -> str:
        calls.append(workspace_page_id)
        return "test"

    monkeypatch.setattr(workspace_service.ai_indexing, "enqueue_workspace_page_index", _fake_enqueue)
    page = await _create_page(db_session, test_user)

    await authed_client.patch(
        f"/api/v1/workspace-pages/{page.id}", json={"blocks": [{"id": "b1", "type": "text", "content": "hi"}]}
    )

    assert calls == [page.id]


async def test_title_only_edit_does_not_trigger_indexing(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, monkeypatch: pytest.MonkeyPatch
):
    calls = []

    async def _fake_enqueue(workspace_page_id: int) -> str:
        calls.append(workspace_page_id)
        return "test"

    monkeypatch.setattr(workspace_service.ai_indexing, "enqueue_workspace_page_index", _fake_enqueue)
    page = await _create_page(db_session, test_user)

    await authed_client.patch(f"/api/v1/workspace-pages/{page.id}", json={"title": "Renamed"})

    assert calls == []


async def test_link_topic_triggers_workspace_indexing(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, monkeypatch: pytest.MonkeyPatch
):
    calls = []

    async def _fake_enqueue(workspace_page_id: int) -> str:
        calls.append(workspace_page_id)
        return "test"

    monkeypatch.setattr(workspace_service.ai_indexing, "enqueue_workspace_page_index", _fake_enqueue)
    page = await _create_page(db_session, test_user)
    topic = await _create_topic(db_session, test_user)

    await authed_client.patch(f"/api/v1/workspace-pages/{page.id}/topic", json={"topic_id": topic.id})

    assert calls == [page.id]


async def test_workspace_page_chunks_are_retrievable_by_topic(
    db_session: AsyncSession, test_user: User
):
    """Directly exercises the storage/retrieval plumbing (bypassing the
    independent-session indexing pipeline, same pattern as
    tests/test_ai_chat.py) -- confirms a workspace page's chunks show up as
    a `workspace_page` source when retrieving by topic."""
    topic = await _create_topic(db_session, test_user)
    page = await _create_page(db_session, test_user, title="My Workspace Notes", topic_id=topic.id)

    await ai_repository.replace_workspace_page_chunks(
        db_session, workspace_page_id=page.id, topic_id=topic.id,
        chunks=["Some workspace content about the topic."], embeddings=[None],
    )

    chunks = await ai_repository.list_topic_chunks(db_session, topic.id)

    assert len(chunks) == 1
    assert chunks[0].source_type == "workspace_page"
    assert chunks[0].source_id == page.id
    assert chunks[0].source_title == "My Workspace Notes"


def test_flatten_block_text_joins_nested_children_depth_first():
    blocks = [
        {"id": "b1", "type": "heading_1", "content": "Title"},
        {
            "id": "b2", "type": "text", "content": "Parent",
            "children": [{"id": "b3", "type": "text", "content": "Child"}],
        },
        {"id": "b4", "type": "divider", "content": ""},
    ]

    assert _flatten_block_text(blocks) == "Title\nParent\nChild"
