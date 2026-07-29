from ...core.exceptions import AppError


class WorkspacePageNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Page not found", 404)


class WorkspaceBlockNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Block not found", 404)
