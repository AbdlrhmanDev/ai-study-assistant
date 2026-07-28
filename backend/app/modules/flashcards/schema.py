from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class FlashcardCreate(StrictModel):
    question: str = Field(min_length=1, max_length=2000)
    answer: str = Field(min_length=1, max_length=4000)
    explanation: str | None = Field(None, max_length=4000)
    noteId: int | None = Field(None, gt=0)
    documentId: int | None = Field(None, gt=0)


class FlashcardUpdate(StrictModel):
    question: str | None = Field(None, min_length=1, max_length=2000)
    answer: str | None = Field(None, min_length=1, max_length=4000)
    explanation: str | None = Field(None, max_length=4000)

    @model_validator(mode="after")
    def require_value(self) -> "FlashcardUpdate":
        touches_explanation = "explanation" in self.model_fields_set
        if self.question is None and self.answer is None and not touches_explanation:
            raise ValueError("At least one field is required")
        return self


class FlashcardArchiveIn(StrictModel):
    archived: bool


class FlashcardGenerate(StrictModel):
    source: Literal["topic", "note", "document"] = "topic"
    noteId: int | None = Field(None, gt=0)
    documentId: int | None = Field(None, gt=0)
    count: int = Field(8, ge=1, le=20)

    @model_validator(mode="after")
    def require_source_id(self) -> "FlashcardGenerate":
        if self.source == "note" and self.noteId is None:
            raise ValueError("noteId is required when source is 'note'")
        if self.source == "document" and self.documentId is None:
            raise ValueError("documentId is required when source is 'document'")
        return self


class FlashcardReviewIn(StrictModel):
    rating: Literal["easy", "medium", "hard", "forgot"]


class FlashcardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic_id: int
    note_id: int | None
    document_id: int | None
    question: str
    answer: str
    explanation: str | None
    origin: str
    status: str
    repetitions: int
    ease_factor: float
    interval_days: int
    due_at: datetime
    last_reviewed_at: datetime | None
    last_rating: str | None
    created_at: datetime
    updated_at: datetime


class DeckStatsOut(BaseModel):
    topic_id: int
    total: int
    due_today: int
    difficult: int
    retention_rate: float | None
    next_review_at: datetime | None


class DashboardStatsOut(BaseModel):
    due_today: int
    difficult: int
    retention_rate: float | None
    next_review_at: datetime | None
