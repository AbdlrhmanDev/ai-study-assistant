from ...core.exceptions import AppError


class MemoryNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Memory not found", 404)
