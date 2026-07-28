from ...core.exceptions import AppError


class ConceptNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Concept not found", 404)


class NoGraphSourceContentError(AppError):
    def __init__(self) -> None:
        super().__init__("There's no material in this topic yet to build a knowledge graph from", 422)


class GraphExtractionParseError(AppError):
    def __init__(self) -> None:
        super().__init__("The AI tutor's knowledge graph response could not be parsed", 502)
