"""Adaptive Quiz Engine: pure ability-estimation math, no DB/IO -- same
isolation pattern as grading.py and scoring.py elsewhere in this codebase.

Rather than a separate over-provisioned candidate pool and a server-driven
"next question" endpoint, adaptivity here is a live ability estimate
(0-1, starting neutral at 0.5) updated after each graded answer using each
question's `difficulty_score`. The estimate is persisted for the results
sparkline; question *ordering* during taking is re-sorted client-side by
proximity to this estimate, so the whole existing fixed-question-set
architecture (generation, taking, results) is reused unchanged.
"""
from dataclasses import dataclass

LEARNING_RATE = 0.35
CORRECT_BONUS = 0.15
INCORRECT_PENALTY = 0.15
DEFAULT_ABILITY = 0.5


@dataclass
class AbilityUpdate:
    ability_estimate: float


def update_ability(*, current_ability: float, question_difficulty: float, is_correct: bool) -> AbilityUpdate:
    question_difficulty = max(0.0, min(1.0, question_difficulty))
    if is_correct:
        target = min(1.0, question_difficulty + CORRECT_BONUS)
    else:
        target = max(0.0, question_difficulty - INCORRECT_PENALTY)
    next_ability = current_ability + LEARNING_RATE * (target - current_ability)
    return AbilityUpdate(ability_estimate=max(0.0, min(1.0, next_ability)))
