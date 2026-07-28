"""Pure grading + analytics logic, no DB/IO -- kept isolated so it's
trivially unit-testable (same reasoning as `ai/rag.py` and
`flashcards/scheduler.py`).

Each question type stores `options`/`correct_answer` as small JSON shapes:
  multiple_choice / scenario: options={"choices": [str, ...]}
                              correct_answer={"index": int}
                              student_answer={"index": int}
  true_false:                 correct_answer={"value": bool}
                              student_answer={"value": bool}
  short_answer / fill_blank:   correct_answer={"accepted": [str, ...]}
                              student_answer={"text": str}
  matching:                   options={"left": [str,...], "right": [str,...]}
                              correct_answer={"pairs": [{"left","right"}, ...]}
                              student_answer={"pairs": [{"left","right"}, ...]}
"""
from typing import Any

QUESTION_TYPES = (
    "multiple_choice", "true_false", "short_answer", "fill_blank", "matching", "scenario",
)


def normalize_text(value: Any) -> str:
    return " ".join(str(value).strip().lower().split())


def grade_answer(question_type: str, correct_answer: dict, student_answer: dict) -> bool:
    if question_type not in QUESTION_TYPES:
        raise ValueError(f"Unknown question type: {question_type!r}")

    if question_type in ("multiple_choice", "scenario"):
        return correct_answer.get("index") == student_answer.get("index")

    if question_type == "true_false":
        return bool(correct_answer.get("value")) == bool(student_answer.get("value"))

    if question_type in ("short_answer", "fill_blank"):
        accepted = {normalize_text(answer) for answer in correct_answer.get("accepted", [])}
        return normalize_text(student_answer.get("text", "")) in accepted

    # matching
    correct_map = {pair["left"]: pair["right"] for pair in correct_answer.get("pairs", [])}
    student_map = {pair["left"]: pair["right"] for pair in student_answer.get("pairs", [])}
    return correct_map == student_map


def summarize_by_concept(graded: list[dict]) -> list[dict]:
    """graded: [{"concept": str, "is_correct": bool}, ...] -> per-concept
    accuracy, in first-seen order (keeps results stable/readable)."""
    order: list[str] = []
    buckets: dict[str, list[bool]] = {}
    for item in graded:
        concept = item["concept"]
        if concept not in buckets:
            buckets[concept] = []
            order.append(concept)
        buckets[concept].append(item["is_correct"])

    summary = []
    for concept in order:
        results = buckets[concept]
        correct = sum(results)
        total = len(results)
        summary.append({
            "concept": concept,
            "correct": correct,
            "total": total,
            "accuracy": round(correct / total * 100, 1) if total else 0.0,
        })
    return summary


def concepts_to_review(concept_summary: list[dict], threshold: float = 70.0) -> list[str]:
    return [item["concept"] for item in concept_summary if item["accuracy"] < threshold]
