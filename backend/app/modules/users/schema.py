from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    profileImageUrl: str | None = None


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class ChangePasswordIn(StrictModel):
    currentPassword: str = Field(min_length=1, max_length=128)
    newPassword: str = Field(min_length=8, max_length=128)


class ReauthenticateIn(StrictModel):
    password: str = Field(min_length=1, max_length=128)


class SessionOut(BaseModel):
    id: str
    device: str
    ipAddress: str | None
    createdAt: str
    lastSeenAt: str | None
    isCurrent: bool
