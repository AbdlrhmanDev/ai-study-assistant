from ...core.exceptions import AppError


class EmptyAiResponseError(AppError):
    def __init__(self) -> None:
        super().__init__("AI tutor returned an empty response", 502)


class UnsupportedFileTypeError(AppError):
    def __init__(self, content_type: str) -> None:
        super().__init__(f"Unsupported file type: {content_type}", 415)


class FileTooLargeError(AppError):
    def __init__(self, max_mb: int) -> None:
        super().__init__(f"File exceeds the {max_mb}MB upload limit", 413)


class DocumentNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Document not found", 404)


class DocumentNotReadyError(AppError):
    def __init__(self, status: str) -> None:
        super().__init__(f"Document is not ready yet (status: {status})", 409)
