from ...core.exceptions import AppError


class AgentSessionNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Agent session not found", 404)


class AgentTopicRequiredError(AppError):
    def __init__(self) -> None:
        super().__init__("This request needs a topic to work with -- pick a topic first", 422)
