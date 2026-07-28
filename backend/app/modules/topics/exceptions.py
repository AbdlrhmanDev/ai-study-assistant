from ...core.exceptions import AppError


class TopicNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Topic not found", 404)
