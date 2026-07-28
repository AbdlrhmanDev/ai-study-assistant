from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class MemoryUpdate(StrictModel):
    value: str = Field(min_length=1, max_length=2000)
