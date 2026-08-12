from typing import Literal

from pydantic import BaseModel, Field


# Single source of truth for answer-feedback reasons, shared with the
# canonical feedback route in modules.ai so the two can never drift apart.
AnswerFeedbackReason = Literal["incorrect", "unclear", "not_grounded", "too_long", "helpful"]


class ProductEventIn(BaseModel):
    name: Literal["signup", "activation", "first_topic", "first_upload", "first_ai_answer", "first_quiz", "first_flashcard_review", "source_click", "paid_conversion", "retained_week_1", "retained_month_1"]
    properties: dict = Field(default_factory=dict)


class AnswerFeedbackIn(BaseModel):
    rating: Literal[-1, 1]
    reason: AnswerFeedbackReason | None = None
    comment: str | None = Field(None, max_length=1000)


class ReminderPreferenceIn(BaseModel):
    emailEnabled: bool
    hourLocal: int = Field(18, ge=0, le=23)
    timezone: str = Field("UTC", min_length=1, max_length=80)
    minimumDueCards: int = Field(1, ge=1, le=500)
