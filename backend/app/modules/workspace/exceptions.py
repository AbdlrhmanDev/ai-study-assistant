from ...core.exceptions import AppError


class WorkspacePageNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Page not found", 404)


class WorkspaceBlockNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Block not found", 404)


class WorkspacePageConflictError(AppError):
    def __init__(self, current: dict) -> None:
        super().__init__(
            "This page was changed elsewhere. Reload to see the latest version before saving again.",
            409,
            {"code": "WORKSPACE_PAGE_CONFLICT", "current": current},
        )
