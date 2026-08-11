from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class AgentDispatchIn(StrictModel):
    message: str = Field(min_length=1, max_length=2000)
    topicId: int | None = Field(default=None, gt=0)
