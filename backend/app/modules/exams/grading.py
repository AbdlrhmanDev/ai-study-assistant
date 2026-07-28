"""Pure grading + Bloom's-level analytics, no DB/IO -- same isolation
pattern as quizzes/grading.py, which this reuses directly for the three
objective question types. Rubric types (essay/case_study/coding) are
scored from an LLM's per-criterion output, never graded here -- this
module only aggregates and reports on scores, it never invents them."""
from ..quizzes.grading import grade_answer as grade_objective_answer

OBJECTIVE_TYPES = ("multiple_choice", "true_false", "short_answer")
RUBRIC_TYPES = ("essay", "case_study", "coding")


def is_objective(question_type: str) -> bool:
    return question_type in OBJECTIVE_TYPES


def points_from_rubric_scores(criteria_scores: list[dict]) -> tuple[float, float]:
    """criteria_scores: [{"maxPoints": number, "score": number}, ...] ->
    (points_earned, points_possible), clamping each score into [0, maxPoints]
    so a malformed LLM response can never award more than the rubric allows."""
    earned = 0.0
    possible = 0.0
    for criterion in criteria_scores:
        max_points = max(0.0, float(criterion.get("maxPoints", 0)))
        score = max(0.0, min(max_points, float(criterion.get("score", 0))))
        earned += score
        possible += max_points
    return earned, possible


def summarize_by_blooms(graded: list[dict]) -> list[dict]:
    """graded: [{"bloomsLevel": str, "pointsEarned": float, "pointsPossible": float}, ...]
    -> per-level totals and accuracy, in first-seen order."""
    order: list[str] = []
    buckets: dict[str, dict[str, float]] = {}
    for item in graded:
        level = item["bloomsLevel"]
        if level not in buckets:
            buckets[level] = {"earned": 0.0, "possible": 0.0}
            order.append(level)
        buckets[level]["earned"] += item["pointsEarned"]
        buckets[level]["possible"] += item["pointsPossible"]

    summary = []
    for level in order:
        bucket = buckets[level]
        accuracy = round(bucket["earned"] / bucket["possible"] * 100, 1) if bucket["possible"] else 0.0
        summary.append({
            "bloomsLevel": level,
            "pointsEarned": round(bucket["earned"], 2),
            "pointsPossible": round(bucket["possible"], 2),
            "accuracy": accuracy,
        })
    return summary


def overall_score(graded: list[dict]) -> float:
    total_earned = sum(item["pointsEarned"] for item in graded)
    total_possible = sum(item["pointsPossible"] for item in graded)
    return round(total_earned / total_possible * 100, 1) if total_possible else 0.0
