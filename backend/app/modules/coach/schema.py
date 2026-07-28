from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class StudyGoalIn(StrictModel):
    examDate: date | None = None
    availableMinutesPerDay: int | None = Field(default=None, ge=5, le=600)


class TaskStatusIn(StrictModel):
    status: Literal["pending", "completed", "skipped"]
