import pytest

from app.modules.agents import service


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("Give me a quiz about APIs", "quiz_generator"),
        ("Create a timed exam", "exam_generator"),
        ("Make flashcards from this topic", "flashcard_generator"),
        ("Build me a study plan", "planner"),
        ("Research this concept and include sources", "researcher"),
        ("Explain database normalization", "tutor"),
        ("سوي لي كويز عن قواعد البيانات", "quiz_generator"),
    ],
)
def test_local_agent_classification(message, expected):
    agent, reasoning = service._classify_locally(message)

    assert agent == expected
    assert "local intent matching" in reasoning


@pytest.mark.asyncio
async def test_classification_uses_local_routing_when_provider_fails(monkeypatch):
    async def fail(*_args, **_kwargs):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(service.provider, "generate", fail)

    agent, reasoning = await service._classify("Give me a quiz about APIs")

    assert agent == "quiz_generator"
    assert reasoning == "Routed to Quiz Generator using local intent matching."
