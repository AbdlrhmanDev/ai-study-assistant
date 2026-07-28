from ...core.exceptions import AppError


class ConceptNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Concept not found in this topic", 404)
