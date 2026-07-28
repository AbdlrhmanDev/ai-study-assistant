from ...core.exceptions import AppError


class StudyPlanTaskNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Study plan task not found", 404)
