from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.ai.model import ChatMessage
from app.modules.topics.model import Topic
from app.modules.users.model import User


async def _create_topic(db_session: AsyncSession, user: User) -> Topic:
    topic = Topic(user_id=user.id, title="Biology", description=None)
    db_session.add(topic)
    await db_session.flush()
    return topic


async def _send_message(authed_client: AsyncClient, topic_id: int, mock_ai_generate) -> int:
    mock_ai_generate("Chlorophyll absorbs light for photosynthesis.")
    response = await authed_client.post(
        f"/api/v1/topics/{topic_id}/ai/chat", json={"question": "What absorbs light?"}
    )
    assert response.status_code == 201, response.text
    return response.json()["messages"]["assistantMessage"]["id"]


async def test_submit_positive_feedback(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    topic = await _create_topic(db_session, test_user)
    message_id = await _send_message(authed_client, topic.id, mock_ai_generate)

    response = await authed_client.put(
        f"/api/v1/ai/messages/{message_id}/feedback", json={"rating": 1, "reason": "helpful"}
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body == {"feedback": {"messageId": message_id, "rating": 1, "reason": "helpful"}}


async def test_resubmitting_feedback_overwrites_the_previous_rating(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    topic = await _create_topic(db_session, test_user)
    message_id = await _send_message(authed_client, topic.id, mock_ai_generate)
    await authed_client.put(f"/api/v1/ai/messages/{message_id}/feedback", json={"rating": 1, "reason": "helpful"})

    response = await authed_client.put(
        f"/api/v1/ai/messages/{message_id}/feedback", json={"rating": -1, "reason": "unclear"}
    )

    assert response.status_code == 200
    assert response.json() == {"feedback": {"messageId": message_id, "rating": -1, "reason": "unclear"}}


async def test_feedback_without_reason_is_allowed(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    topic = await _create_topic(db_session, test_user)
    message_id = await _send_message(authed_client, topic.id, mock_ai_generate)

    response = await authed_client.put(f"/api/v1/ai/messages/{message_id}/feedback", json={"rating": 1})

    assert response.status_code == 200
    assert response.json()["feedback"]["reason"] is None


async def test_feedback_rejects_invalid_rating(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    topic = await _create_topic(db_session, test_user)
    message_id = await _send_message(authed_client, topic.id, mock_ai_generate)

    response = await authed_client.put(f"/api/v1/ai/messages/{message_id}/feedback", json={"rating": 0})

    assert response.status_code == 422


async def test_feedback_on_unowned_message_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User
):
    topic = await _create_topic(db_session, other_user)
    message = ChatMessage(topic_id=topic.id, role="assistant", message="Some answer")
    db_session.add(message)
    await db_session.flush()

    response = await authed_client.put(f"/api/v1/ai/messages/{message.id}/feedback", json={"rating": 1})

    assert response.status_code == 404


async def test_feedback_on_nonexistent_message_returns_404(authed_client: AsyncClient):
    response = await authed_client.put("/api/v1/ai/messages/999999/feedback", json={"rating": 1})

    assert response.status_code == 404
