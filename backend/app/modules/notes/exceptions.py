from ...core.exceptions import AppError


class NoteNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Note not found", 404)
