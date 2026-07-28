from ...core.exceptions import AppError


class NoMindMapSourceContentError(AppError):
    def __init__(self) -> None:
        super().__init__("There's no material in this topic yet to build a mind map from", 422)


class MindMapParseError(AppError):
    def __init__(self) -> None:
        super().__init__("The AI tutor's mind map response could not be parsed", 502)
