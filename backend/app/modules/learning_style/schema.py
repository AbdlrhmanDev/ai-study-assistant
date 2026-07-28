from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class LearningStyleWeightsIn(StrictModel):
    visual: float = Field(ge=0)
    reading: float = Field(ge=0)
    practice: float = Field(ge=0)
    flashcards: float = Field(ge=0)
    examples: float = Field(ge=0)
    conversation: float = Field(ge=0)
