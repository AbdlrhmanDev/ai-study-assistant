from ...core.exceptions import AppError


class RebuildCooldownError(AppError):
    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__(
            f"This was just rebuilt -- try again in {retry_after_seconds}s. "
            "Rebuilding calls the AI provider, so we throttle repeat requests.",
            429,
            {"retryAfterSeconds": retry_after_seconds},
        )
