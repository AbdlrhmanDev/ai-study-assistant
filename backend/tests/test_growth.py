from app.modules.ai.model import ChatMessage
from app.modules.topics.model import Topic


async def test_answer_feedback_and_reminder_preferences(authed_client, db_session, test_user):
    topic = Topic(user_id=test_user.id, title="Growth Test")
    db_session.add(topic)
    await db_session.flush()
    message = ChatMessage(topic_id=topic.id, role="assistant", message="Grounded answer")
    db_session.add(message)
    await db_session.flush()

    response = await authed_client.put(
        f"/api/v1/ai/messages/{message.id}/feedback",
        json={"rating": 1, "reason": "helpful"},
    )
    assert response.status_code == 200
    assert response.json()["feedback"]["rating"] == 1

    response = await authed_client.put("/api/v1/reminders/preferences", json={
        "emailEnabled": True, "hourLocal": 19, "timezone": "Asia/Riyadh", "minimumDueCards": 5,
    })
    assert response.status_code == 200
    assert response.json() == {
        "emailEnabled": True, "hourLocal": 19, "timezone": "Asia/Riyadh", "minimumDueCards": 5,
    }


async def test_product_event_is_accepted(authed_client):
    response = await authed_client.post(
        "/api/v1/product-events", json={"name": "activation", "properties": {"source": "test"}}
    )
    assert response.status_code == 202
    assert response.json() == {"accepted": True}
