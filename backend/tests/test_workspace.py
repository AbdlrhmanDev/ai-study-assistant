from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.topics.model import Topic
from app.modules.users.model import User
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
