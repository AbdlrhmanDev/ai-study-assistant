from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class RegisterIn(StrictModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(StrictModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ProfileUpdate(StrictModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    email: EmailStr | None = None

    @model_validator(mode="after")
    def require_value(self) -> "ProfileUpdate":
        if self.name is None and self.email is None:
            raise ValueError("At least one field is required")
        return self


class ForgotPasswordIn(StrictModel):
    email: EmailStr


class ResetPasswordIn(StrictModel):
    token: str = Field(min_length=1, max_length=200)
    newPassword: str = Field(min_length=8, max_length=128)
