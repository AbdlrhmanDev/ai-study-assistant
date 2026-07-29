import json

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notes.model import Note
from app.modules.topics.model import Topic
from app.modules.users.model import User

MOCK_QUIZ_RESPONSE = json.dumps([
    {
        "type": "multiple_choice", "concept": "Photosynthesis", "prompt": "What pigment absorbs light?",
        "choices": ["Chlorophyll", "Melanin", "Keratin", "Collagen"], "correctIndex": 0,
        "explanation": "Chlorophyll absorbs light for photosynthesis.", "sourceIndex": 1, "difficulty": 0.3,
    },
    {
        "type": "true_false", "concept": "Photosynthesis", "prompt": "Photosynthesis occurs in mitochondria.",
        "correctValue": False, "explanation": "It occurs in chloroplasts, not mitochondria.",
        "sourceIndex": 1, "difficulty": 0.4,
    },
])


async def _create_topic_with_note(db_session: AsyncSession, user: User) -> Topic:
    topic = Topic(user_id=user.id, title="Biology", description=None)
    db_session.add(topic)
    await db_session.flush()
    note = Note(topic_id=topic.id, title="Photosynthesis", content="Plants convert light into energy using chlorophyll.")
    db_session.add(note)
    await db_session.flush()
    return topic


async def _generate_quiz(authed_client: AsyncClient, topic_id: int) -> dict:
    response = await authed_client.post(
        f"/api/v1/topics/{topic_id}/quizzes/generate", json={"source": "topic", "count": 2}
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_generate_quiz_creates_quiz_and_questions(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_QUIZ_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)

    body = await _generate_quiz(authed_client, topic.id)

    assert body["quiz"]["topic_id"] == topic.id
    assert len(body["questions"]) == 2
    for question in body["questions"]:
        assert "correct_answer" not in question and "correctAnswer" not in question


async def test_generate_quiz_without_content_returns_422(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    topic = Topic(user_id=test_user.id, title="Empty Topic", description=None)
    db_session.add(topic)
    await db_session.flush()

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 2}
    )

    assert response.status_code == 422


async def test_generate_quiz_unowned_topic_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User, mock_ai_generate
):
    topic = await _create_topic_with_note(db_session, other_user)

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 2}
    )

    assert response.status_code == 404


async def test_generate_quiz_unparseable_ai_response_returns_502(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate("this is not json")
    topic = await _create_topic_with_note(db_session, test_user)

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 2}
    )

    assert response.status_code == 502


async def test_list_quizzes_includes_generated_quiz(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_QUIZ_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    generated = await _generate_quiz(authed_client, topic.id)

    response = await authed_client.get(f"/api/v1/topics/{topic.id}/quizzes")

    assert response.status_code == 200
    quiz_ids = [quiz["id"] for quiz in response.json()["quizzes"]]
    assert generated["quiz"]["id"] in quiz_ids


async def test_full_attempt_flow_grades_and_completes(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_QUIZ_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    generated = await _generate_quiz(authed_client, topic.id)
    quiz_id = generated["quiz"]["id"]
    mc_question, tf_question = generated["questions"]

    attempt_response = await authed_client.post(f"/api/v1/quizzes/{quiz_id}/attempts", json={})
    assert attempt_response.status_code == 201
    attempt_id = attempt_response.json()["attempt"]["id"]

    correct_response = await authed_client.post(
        f"/api/v1/quizzes/attempts/{attempt_id}/answers",
        json={"questionId": mc_question["id"], "answer": {"index": 0}},
    )
    assert correct_response.status_code == 200
    assert correct_response.json()["isCorrect"] is True

    wrong_response = await authed_client.post(
        f"/api/v1/quizzes/attempts/{attempt_id}/answers",
        json={"questionId": tf_question["id"], "answer": {"value": True}},
    )
    assert wrong_response.status_code == 200
    assert wrong_response.json()["isCorrect"] is False

    complete_response = await authed_client.post(f"/api/v1/quizzes/attempts/{attempt_id}/complete")
    assert complete_response.status_code == 200
    result = complete_response.json()
    assert result["correctCount"] == 1
    assert result["totalCount"] == 2
    assert result["score"] == 50.0


async def test_delete_quiz_removes_it(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_QUIZ_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    generated = await _generate_quiz(authed_client, topic.id)
    quiz_id = generated["quiz"]["id"]

    delete_response = await authed_client.delete(f"/api/v1/quizzes/{quiz_id}")
    assert delete_response.status_code == 204

    get_response = await authed_client.get(f"/api/v1/quizzes/{quiz_id}")
    assert get_response.status_code == 404
