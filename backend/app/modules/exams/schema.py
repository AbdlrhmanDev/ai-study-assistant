from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .model import BLOOMS_LEVELS, EXAM_QUESTION_TYPES


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class ExamGenerate(StrictModel):
    count: int = Field(10, ge=4, le=40)
    timeLimitMinutes: int = Field(45, ge=5, le=240)
    questionTypes: list[Literal[EXAM_QUESTION_TYPES]] = Field(  # type: ignore[valid-type]
        default_factory=lambda: list(EXAM_QUESTION_TYPES)
    )
    bloomsLevels: list[Literal[BLOOMS_LEVELS]] = Field(  # type: ignore[valid-type]
        default_factory=lambda: list(BLOOMS_LEVELS)
    )
    preview: bool = False

    @model_validator(mode="after")
    def require_at_least_one_of_each(self) -> "ExamGenerate":
        if not self.questionTypes:
            raise ValueError("At least one question type is required")
        if not self.bloomsLevels:
            raise ValueError("At least one Bloom's level is required")
        return self


class ExamQuestionEdit(StrictModel):
    """Patch fields for a draft exam question. `choices`/`correctIndex` only
    apply to `multiple_choice`, `correctValue` to `true_false`,
    `acceptedAnswers` to `short_answer`, and `rubric` to rubric-graded types
    (essay / case_study / coding)."""

    prompt: str | None = Field(None, min_length=1, max_length=4000)
    explanation: str | None = Field(None, min_length=1, max_length=4000)
    concept: str | None = Field(None, min_length=1, max_length=200)
    bloomsLevel: str | None = None
    choices: list[str] | None = None
    correctIndex: int | None = None
    correctValue: bool | None = None
    acceptedAnswers: list[str] | None = None
    rubric: list[dict[str, Any]] | None = None


class ExamAnswerSubmit(StrictModel):
    questionId: int = Field(gt=0)
    answer: dict[str, Any]
