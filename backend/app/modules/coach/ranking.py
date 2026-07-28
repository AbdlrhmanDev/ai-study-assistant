"""Pure ranking math for the daily plan -- same isolation pattern as
mastery/scoring.py. Urgency is deterministic (weakness x exam-proximity);
only the plan's phrasing ever touches an LLM."""
from dataclasses import dataclass
from datetime import date

MINUTES_PER_TASK = 15
MAX_TASKS = 8
DEFAULT_AVAILABLE_MINUTES = 30
EXAM_PROXIMITY_WINDOW_DAYS = 7.0
OVERDUE_PROXIMITY_WEIGHT = 2.0


@dataclass
class ConceptSignal:
    concept_id: int
    concept_name: str
    topic_id: int
    mastery_score: float  # effective (decayed), 0-1


@dataclass
class RankedTask:
    concept_id: int
    concept_name: str
    topic_id: int
    urgency: float


def urgency_score(mastery_score: float, exam_date: date | None, today: date) -> float:
    """Higher is more urgent. No exam date set -> pure weakness (maintain-
    mastery mode). An exam date raises urgency the closer it gets, capping
    once the exam is today or has passed."""
    weakness = max(0.0, 1.0 - max(0.0, min(1.0, mastery_score)))
    if exam_date is None:
        return weakness
    days_until = (exam_date - today).days
    if days_until <= 0:
        proximity = OVERDUE_PROXIMITY_WEIGHT
    else:
        proximity = 1.0 + 1.0 / (1.0 + days_until / EXAM_PROXIMITY_WINDOW_DAYS)
    return weakness * proximity


def rank_concepts(
    concepts: list[ConceptSignal], exam_dates_by_topic: dict[int, date | None], today: date
) -> list[RankedTask]:
    ranked = [
        RankedTask(
            concept_id=concept.concept_id,
            concept_name=concept.concept_name,
            topic_id=concept.topic_id,
            urgency=urgency_score(concept.mastery_score, exam_dates_by_topic.get(concept.topic_id), today),
        )
        for concept in concepts
    ]
    ranked.sort(key=lambda task: task.urgency, reverse=True)
    return ranked


def select_for_budget(ranked: list[RankedTask], available_minutes: int | None) -> list[RankedTask]:
    """Caps the ranked list to whatever fits in the day's minute budget,
    never more than MAX_TASKS regardless of budget size."""
    budget = available_minutes if available_minutes and available_minutes > 0 else DEFAULT_AVAILABLE_MINUTES
    max_by_budget = max(1, budget // MINUTES_PER_TASK)
    return ranked[: min(MAX_TASKS, max_by_budget)]
