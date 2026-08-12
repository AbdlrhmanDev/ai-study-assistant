import json

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notes.model import Note
from app.modules.topics.model import Topic
from app.modules.users.model import User

MOCK_EXAM_RESPONSE = json.dumps([
    {
        "type": "multiple_choice", "bloomsLevel": "remember", "concept": "Photosynthesis",
        "prompt": "What pigment absorbs light?", "choices": ["Chlorophyll", "Melanin", "Keratin", "Collagen"],
        "correctIndex": 0, "explanation": "Chlorophyll absorbs light.", "sourceIndex": 1,
    },
    {
        "type": "essay", "bloomsLevel": "analyze", "concept": "Photosynthesis",
        "prompt": "Explain the role of chlorophyll in photosynthesis.",
        "rubric": [
            {"criterion": "Mentions light absorption", "maxPoints": 3, "description": "Explains chlorophyll absorbs light"},
            {"criterion": "Mentions energy conversion", "maxPoints": 2, "description": "Explains conversion to chemical energy"},
        ],
        "explanation": "Chlorophyll absorbs light and converts it to chemical energy.", "sourceIndex": 1,
    },
])

MOCK_RUBRIC_GRADING_RESPONSE = json.dumps({
    "criteria": [
        {"criterion": "Mentions light absorption", "score": 3, "evidence": "chlorophyll absorbs sunlight"},
        {"criterion": "Mentions energy conversion", "score": 1, "evidence": "converts it to energy"},
    ]
})


async def _create_topic_with_note(db_session: AsyncSession, user: User) -> Topic:
    topic = Topic(user_id=user.id, title="Biology", description=None)
    db_session.add(topic)
    await db_session.flush()
    note = Note(topic_id=topic.id, title="Photosynthesis", content="Plants convert light into energy using chlorophyll.")
    db_session.add(note)
    await db_session.flush()
    return topic


async def _generate_exam(authed_client: AsyncClient, topic_id: int) -> dict:
    response = await authed_client.post(
        f"/api/v1/topics/{topic_id}/exams/generate", json={"count": 4, "timeLimitMinutes": 30}
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_generate_exam_creates_exam_and_questions(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_EXAM_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)

    body = await _generate_exam(authed_client, topic.id)

    assert body["exam"]["topicId"] == topic.id
    assert len(body["questions"]) == 2
    for question in body["questions"]:
        assert "correctAnswer" not in question and "rubric" not in question


async def test_generate_exam_without_content_returns_422(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    topic = Topic(user_id=test_user.id, title="Empty Topic", description=None)
    db_session.add(topic)
    await db_session.flush()

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/exams/generate", json={"count": 4}
    )

    assert response.status_code == 422


async def test_generate_exam_unowned_topic_returns_404(
    authed_client: AsyncClient, db_session: AsyncSession, other_user: User, mock_ai_generate
):
    topic = await _create_topic_with_note(db_session, other_user)

    response = await authed_client.post(f"/api/v1/topics/{topic.id}/exams/generate", json={"count": 4})

    assert response.status_code == 404


async def test_start_attempt_returns_deadline(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_EXAM_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    generated = await _generate_exam(authed_client, topic.id)

    response = await authed_client.post(f"/api/v1/exams/{generated['exam']['id']}/attempts")

    assert response.status_code == 201
    assert response.json()["deadlineAt"] is not None


async def test_full_attempt_flow_grades_objective_and_rubric(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_EXAM_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    generated = await _generate_exam(authed_client, topic.id)
    exam_id = generated["exam"]["id"]
    mc_question, essay_question = generated["questions"]

    attempt_response = await authed_client.post(f"/api/v1/exams/{exam_id}/attempts")
    attempt_id = attempt_response.json()["attempt"]["id"]

    mc_answer = await authed_client.post(
        f"/api/v1/exams/attempts/{attempt_id}/answers",
        json={"questionId": mc_question["id"], "answer": {"index": 0}},
    )
    assert mc_answer.status_code == 200
    assert mc_answer.json()["isCorrect"] is True

    essay_answer = await authed_client.post(
        f"/api/v1/exams/attempts/{attempt_id}/answers",
        json={"questionId": essay_question["id"], "answer": {"text": "Chlorophyll absorbs sunlight and converts it to energy."}},
    )
    assert essay_answer.status_code == 200
    assert essay_answer.json()["isCorrect"] is None  # rubric-graded, not auto-graded here

    mock_ai_generate(MOCK_RUBRIC_GRADING_RESPONSE)
    submit_response = await authed_client.post(f"/api/v1/exams/attempts/{attempt_id}/submit")

    assert submit_response.status_code == 200
    result = submit_response.json()
    assert result["status"] == "completed"
    # 1/1 objective point + 4/5 rubric points = 5/6 ~= 83.3%
    assert result["score"] == 83.3


async def test_exam_analytics_reports_per_question_points(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_EXAM_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    generated = await _generate_exam(authed_client, topic.id)
    exam_id = generated["exam"]["id"]
    mc_question, essay_question = generated["questions"]

    attempt_response = await authed_client.post(f"/api/v1/exams/{exam_id}/attempts")
    attempt_id = attempt_response.json()["attempt"]["id"]
    await authed_client.post(
        f"/api/v1/exams/attempts/{attempt_id}/answers",
        json={"questionId": mc_question["id"], "answer": {"index": 0}},
    )
    await authed_client.post(
        f"/api/v1/exams/attempts/{attempt_id}/answers",
        json={"questionId": essay_question["id"], "answer": {"text": "Chlorophyll absorbs sunlight and converts it to energy."}},
    )
    mock_ai_generate(MOCK_RUBRIC_GRADING_RESPONSE)
    await authed_client.post(f"/api/v1/exams/attempts/{attempt_id}/submit")

    response = await authed_client.get(f"/api/v1/exams/{exam_id}/analytics")

    assert response.status_code == 200, response.text
    stats = {entry["questionId"]: entry for entry in response.json()["questions"]}
    assert stats[mc_question["id"]]["timesAnswered"] == 1
    assert stats[mc_question["id"]]["averageScore"] == 1.0
    assert stats[essay_question["id"]]["averageScore"] == round(4 / 5, 3)


async def test_generate_exam_avoids_repeating_existing_topic_questions(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_EXAM_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    await _generate_exam(authed_client, topic.id)  # seeds two existing prompts

    duplicate_and_new = json.dumps([
        json.loads(MOCK_EXAM_RESPONSE)[0],  # exact duplicate prompt
        {
            "type": "true_false", "bloomsLevel": "remember", "concept": "Photosynthesis",
            "prompt": "Chlorophyll is found in chloroplasts.", "correctValue": True,
            "explanation": "Chloroplasts contain chlorophyll.", "sourceIndex": 1,
        },
    ])
    mock_ai_generate(duplicate_and_new)

    second = await authed_client.post(
        f"/api/v1/topics/{topic.id}/exams/generate", json={"count": 4, "timeLimitMinutes": 30}
    )

    assert second.status_code == 201, second.text
    prompts = [q["prompt"] for q in second.json()["questions"]]
    assert "What pigment absorbs light?" not in prompts
    assert "Chlorophyll is found in chloroplasts." in prompts


async def test_delete_exam_removes_it(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_EXAM_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    generated = await _generate_exam(authed_client, topic.id)

    delete_response = await authed_client.delete(f"/api/v1/exams/{generated['exam']['id']}")
    assert delete_response.status_code == 204

    get_response = await authed_client.get(f"/api/v1/exams/{generated['exam']['id']}")
    assert get_response.status_code == 404
