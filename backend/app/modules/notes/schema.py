from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class NoteCreate(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)


class NoteUpdate(StrictModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    content: str | None = Field(None, min_length=1)

    @model_validator(mode="after")
    def require_value(self) -> "NoteUpdate":
        if self.title is None and self.content is None:
            raise ValueError("At least one field is required")
        return self


class MoveNote(StrictModel):
    targetTopicId: int = Field(gt=0)


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic_id: int
    title: str
    content: str
    created_at: datetime
    updated_at: datetime
