from ...core.exceptions import AppError


class FlashcardNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Flashcard not found", 404)


class FlashcardSourceNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Source note or document not found in this topic", 404)


class FlashcardSourceNotReadyError(AppError):
    def __init__(self, status: str) -> None:
        super().__init__(f"Source document is not ready yet (status: {status})", 409)


class NoFlashcardSourceContentError(AppError):
    def __init__(self) -> None:
        super().__init__(
            "There's no note or document content in this topic yet to generate flashcards from", 422
        )


class FlashcardGenerationParseError(AppError):
    def __init__(self) -> None:
        super().__init__("The AI tutor's flashcard response could not be parsed", 502)


class FlashcardNotRegeneratableError(AppError):
    def __init__(self) -> None:
        super().__init__(
            "This card has no linked note or document, so it can't be regenerated", 409
        )


class EmptyFlashcardImportError(AppError):
    def __init__(self) -> None:
        super().__init__(
            "No valid flashcards found in that file -- each row needs at least a question and an answer", 422
        )


class FlashcardImportTooLargeError(AppError):
    def __init__(self, max_rows: int) -> None:
        super().__init__(f"That file has more than {max_rows} rows -- split it into smaller batches", 413)
