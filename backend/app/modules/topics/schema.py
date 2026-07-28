from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class TopicCreate(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(None, max_length=1000)


class TopicUpdate(StrictModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=1000)

    @model_validator(mode="after")
    def require_value(self) -> "TopicUpdate":
        if "title" not in self.model_fields_set and "description" not in self.model_fields_set:
            raise ValueError("At least one field is required")
        return self


class TopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    created_at: datetime
    updated_at: datetime
