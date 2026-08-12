from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .model import DIFFICULTIES, QUESTION_TYPES, QUIZ_SOURCES


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class QuizGenerate(StrictModel):
    source: Literal[QUIZ_SOURCES] = "topic"  # type: ignore[valid-type]
    noteId: int | None = Field(None, gt=0)
    documentId: int | None = Field(None, gt=0)
    concept: str | None = Field(None, min_length=1, max_length=300)
    count: int = Field(10, ge=1, le=30)
    difficulty: Literal[DIFFICULTIES] = "medium"  # type: ignore[valid-type]
    questionTypes: list[Literal[QUESTION_TYPES]] = Field(default_factory=lambda: list(QUESTION_TYPES))  # type: ignore[valid-type]
    timed: bool = False
    timeLimitSeconds: int | None = Field(None, ge=30, le=7200)
    adaptive: bool = False
    preview: bool = False

    @model_validator(mode="after")
    def require_source_fields(self) -> "QuizGenerate":
        if self.source == "note" and self.noteId is None:
            raise ValueError("noteId is required when source is 'note'")
        if self.source == "document" and self.documentId is None:
            raise ValueError("documentId is required when source is 'document'")
        if self.source == "concept" and not self.concept:
            raise ValueError("concept is required when source is 'concept'")
        if not self.questionTypes:
            raise ValueError("At least one question type is required")
        if self.timed and not self.timeLimitSeconds:
            raise ValueError("timeLimitSeconds is required when timed is true")
        return self


class AttemptStart(StrictModel):
    immediateFeedback: bool = True


class AnswerSubmit(StrictModel):
    questionId: int = Field(gt=0)
    answer: dict[str, Any]


class QuestionEdit(StrictModel):
    """Patch fields for a draft question. Only fields matching the
    question's existing `question_type` are applied -- e.g. `correctIndex`
    is ignored on a `true_false` question."""

    prompt: str | None = Field(None, min_length=1, max_length=4000)
    explanation: str | None = Field(None, min_length=1, max_length=4000)
    concept: str | None = Field(None, min_length=1, max_length=200)
    choices: list[str] | None = None
    correctIndex: int | None = None
    correctValue: bool | None = None
    acceptedAnswers: list[str] | None = None
    pairs: list[dict[str, str]] | None = None


class QuizOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic_id: int
    title: str
    source_type: str
    note_id: int | None
    document_id: int | None
    concept: str | None
    difficulty: str
    adaptive: bool
    timed: bool
    time_limit_seconds: int | None
    status: str
    created_at: datetime


class QuestionForTakingOut(BaseModel):
    """Sent while a quiz is in progress -- withholds the answer key."""

    id: int
    order_index: int
    question_type: str
    concept: str
    prompt: str
    options: dict[str, Any] | None


class QuestionResultOut(BaseModel):
    """Includes the answer key -- only for grading responses and results."""

    id: int
    order_index: int
    question_type: str
    concept: str
    prompt: str
    options: dict[str, Any] | None
    correct_answer: dict[str, Any]
    explanation: str
    source_type: Literal["note", "document"] | None = None
    source_title: str | None = None
