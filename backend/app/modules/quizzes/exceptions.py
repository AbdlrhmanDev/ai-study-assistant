from ...core.exceptions import AppError


class QuizNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Quiz not found", 404)


class QuizQuestionNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Question not found in this quiz", 404)


class QuizAttemptNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Quiz attempt not found", 404)


class QuizAttemptAlreadyCompletedError(AppError):
    def __init__(self) -> None:
        super().__init__("This quiz attempt is already completed", 409)


class QuizSourceNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Source note or document not found in this topic", 404)


class QuizSourceNotReadyError(AppError):
    def __init__(self, status: str) -> None:
        super().__init__(f"Source document is not ready yet (status: {status})", 409)


class NoQuizSourceContentError(AppError):
    def __init__(self) -> None:
        super().__init__(
            "There's no material in this topic yet to generate a quiz from", 422
        )


class NoWeakAreasYetError(AppError):
    def __init__(self) -> None:
        super().__init__(
            "No incorrect answers yet in this topic to build a follow-up quiz from", 422
        )


class QuizGenerationParseError(AppError):
    def __init__(self) -> None:
        super().__init__("The AI tutor's quiz response could not be parsed", 502)


class QuizAnswerNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Answer not found in this attempt", 404)


class AnswerAlreadyCorrectError(AppError):
    def __init__(self) -> None:
        super().__init__("This answer was already correct -- nothing to diagnose", 409)


class QuizNotEditableError(AppError):
    def __init__(self) -> None:
        super().__init__("Only draft quizzes can be edited or regenerated -- publish locks it in", 409)


class QuizNotPublishedError(AppError):
    def __init__(self) -> None:
        super().__init__("Publish this quiz before starting an attempt", 409)


class InvalidQuestionEditError(AppError):
    def __init__(self) -> None:
        super().__init__("That edit isn't valid for this question's type", 422)
