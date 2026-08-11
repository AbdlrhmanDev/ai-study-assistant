from ...core.exceptions import AppError


class EmailAlreadyRegisteredError(AppError):
    def __init__(self) -> None:
        super().__init__("Email is already registered", 409)


class UserNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("User not found", 404)


class InvalidCurrentPasswordError(AppError):
    def __init__(self) -> None:
        super().__init__("Current password is incorrect", 401)


class SessionNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Session not found", 404)
