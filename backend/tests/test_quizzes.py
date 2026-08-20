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


async def test_list_all_quizzes_returns_user_quizzes_in_one_endpoint(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_QUIZ_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    created = await _generate_quiz(authed_client, topic.id)

    response = await authed_client.get("/api/v1/quizzes?limit=20")

    assert response.status_code == 200
    rows = response.json()["quizzes"]
    assert [row["id"] for row in rows] == [created["quiz"]["id"]]
    assert rows[0]["questionCount"] == 2


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


async def test_preview_quiz_is_draft_and_includes_answer_key(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_QUIZ_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)

    response = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 2, "preview": True}
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["quiz"]["status"] == "draft"
    for question in body["questions"]:
        assert "correctAnswer" in question


async def test_cannot_start_attempt_on_a_draft_quiz(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_QUIZ_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    generated = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 2, "preview": True}
    )
    quiz_id = generated.json()["quiz"]["id"]

    response = await authed_client.post(f"/api/v1/quizzes/{quiz_id}/attempts", json={})

    assert response.status_code == 409


async def test_publish_quiz_allows_starting_an_attempt(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_QUIZ_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    generated = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 2, "preview": True}
    )
    quiz_id = generated.json()["quiz"]["id"]

    publish_response = await authed_client.post(f"/api/v1/quizzes/{quiz_id}/publish")
    assert publish_response.status_code == 200
    assert publish_response.json()["quiz"]["status"] == "published"

    attempt_response = await authed_client.post(f"/api/v1/quizzes/{quiz_id}/attempts", json={})
    assert attempt_response.status_code == 201


async def test_edit_draft_question_updates_prompt_and_choices(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_QUIZ_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    generated = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 2, "preview": True}
    )
    quiz_id = generated.json()["quiz"]["id"]
    mc_question = generated.json()["questions"][0]

    response = await authed_client.patch(
        f"/api/v1/quizzes/{quiz_id}/questions/{mc_question['id']}",
        json={"prompt": "What pigment absorbs light for photosynthesis?", "choices": ["Chlorophyll", "Melanin", "Keratin"], "correctIndex": 0},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["prompt"] == "What pigment absorbs light for photosynthesis?"
    assert body["options"]["choices"] == ["Chlorophyll", "Melanin", "Keratin"]


async def test_edit_question_on_published_quiz_is_rejected(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_QUIZ_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    generated = await _generate_quiz(authed_client, topic.id)
    quiz_id = generated["quiz"]["id"]
    question_id = generated["questions"][0]["id"]

    response = await authed_client.patch(
        f"/api/v1/quizzes/{quiz_id}/questions/{question_id}", json={"prompt": "Edited"}
    )

    assert response.status_code == 409


async def test_delete_draft_question_removes_it(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_QUIZ_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    generated = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 2, "preview": True}
    )
    quiz_id = generated.json()["quiz"]["id"]
    question_id = generated.json()["questions"][0]["id"]

    response = await authed_client.delete(f"/api/v1/quizzes/{quiz_id}/questions/{question_id}")
    assert response.status_code == 204

    quiz_response = await authed_client.get(f"/api/v1/quizzes/{quiz_id}")
    assert question_id not in [q["id"] for q in quiz_response.json()["questions"]]


REGENERATED_QUESTION_RESPONSE = json.dumps([
    {
        "type": "multiple_choice", "concept": "Photosynthesis", "prompt": "Which pigment is key to capturing light energy?",
        "choices": ["Chlorophyll", "Hemoglobin", "Insulin", "Amylase"], "correctIndex": 0,
        "explanation": "Chlorophyll captures light energy for photosynthesis.", "sourceIndex": 1, "difficulty": 0.3,
    },
])


async def test_regenerate_draft_question_replaces_its_content(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_QUIZ_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    generated = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 2, "preview": True}
    )
    quiz_id = generated.json()["quiz"]["id"]
    mc_question = generated.json()["questions"][0]

    mock_ai_generate(REGENERATED_QUESTION_RESPONSE)
    response = await authed_client.post(
        f"/api/v1/quizzes/{quiz_id}/questions/{mc_question['id']}/regenerate"
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["prompt"] == "Which pigment is key to capturing light energy?"
    assert body["id"] == mc_question["id"]


async def test_quiz_analytics_reports_per_question_accuracy(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    mock_ai_generate(MOCK_QUIZ_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    generated = await _generate_quiz(authed_client, topic.id)
    quiz_id = generated["quiz"]["id"]
    mc_question, tf_question = generated["questions"]

    attempt_response = await authed_client.post(f"/api/v1/quizzes/{quiz_id}/attempts", json={})
    attempt_id = attempt_response.json()["attempt"]["id"]
    await authed_client.post(
        f"/api/v1/quizzes/attempts/{attempt_id}/answers",
        json={"questionId": mc_question["id"], "answer": {"index": 0}},
    )
    await authed_client.post(
        f"/api/v1/quizzes/attempts/{attempt_id}/answers",
        json={"questionId": tf_question["id"], "answer": {"value": True}},
    )

    response = await authed_client.get(f"/api/v1/quizzes/{quiz_id}/analytics")

    assert response.status_code == 200, response.text
    stats = {entry["questionId"]: entry for entry in response.json()["questions"]}
    assert stats[mc_question["id"]]["timesAnswered"] == 1
    assert stats[mc_question["id"]]["correctCount"] == 1
    assert stats[mc_question["id"]]["accuracy"] == 1.0
    assert stats[tf_question["id"]]["correctCount"] == 0
    assert stats[tf_question["id"]]["accuracy"] == 0.0


async def test_generate_quiz_avoids_repeating_existing_topic_questions(
    authed_client: AsyncClient, db_session: AsyncSession, test_user: User, mock_ai_generate
):
    """The AI is told to avoid the topic's existing prompts, but as a safety
    net for when it repeats one anyway, the exact duplicate must be dropped
    server-side rather than saved twice."""
    mock_ai_generate(MOCK_QUIZ_RESPONSE)
    topic = await _create_topic_with_note(db_session, test_user)
    await _generate_quiz(authed_client, topic.id)  # seeds two existing prompts

    duplicate_and_new = json.dumps([
        json.loads(MOCK_QUIZ_RESPONSE)[0],  # exact duplicate prompt
        {
            "type": "true_false", "concept": "Photosynthesis", "prompt": "Chlorophyll is found in chloroplasts.",
            "correctValue": True, "explanation": "Chloroplasts contain chlorophyll.", "sourceIndex": 1, "difficulty": 0.2,
        },
    ])
    mock_ai_generate(duplicate_and_new)

    second = await authed_client.post(
        f"/api/v1/topics/{topic.id}/quizzes/generate", json={"source": "topic", "count": 2}
    )

    assert second.status_code == 201, second.text
    prompts = [q["prompt"] for q in second.json()["questions"]]
    assert "What pigment absorbs light?" not in prompts
    assert "Chlorophyll is found in chloroplasts." in prompts


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
