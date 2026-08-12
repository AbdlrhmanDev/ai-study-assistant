from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..growth.schema import AnswerFeedbackReason


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class MessageFeedbackIn(StrictModel):
    rating: Literal[-1, 1]
    reason: AnswerFeedbackReason | None = None
    comment: str | None = Field(None, max_length=1000)


class ChatIn(StrictModel):
    question: str = Field(min_length=1, max_length=2000)
    documentId: int | None = Field(default=None, gt=0)
    mode: Literal["tutor", "sparring"] = "tutor"
    concept: str | None = Field(default=None, min_length=1, max_length=300)
    sparStart: bool = False

    @model_validator(mode="after")
    def require_concept_for_sparring(self) -> "ChatIn":
        if self.mode == "sparring" and not self.concept:
            raise ValueError("concept is required when mode is 'sparring'")
        return self


class SourceOut(BaseModel):
    sourceType: Literal["note", "document", "workspace_page"]
    sourceId: int
    sourceTitle: str
    excerpt: str
    score: float
    similarity: float | None = None


class SourceClickIn(StrictModel):
    """Which cited source a user actually clicked on, so retrieval quality can
    be measured beyond generation (was the cited chunk useful?)."""

    sourceType: Literal["note", "document", "workspace_page"]
    sourceId: int = Field(..., gt=0)
    score: float | None = None


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic_id: int
    title: str
    original_filename: str
    content_type: str
    status: str
    error_message: str | None
    created_at: datetime
    updated_at: datetime
