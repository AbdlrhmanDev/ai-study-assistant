from ...core.exceptions import AppError


class ExamNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Exam not found", 404)


class ExamQuestionNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Question not found in this exam", 404)


class ExamAttemptNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__("Exam attempt not found", 404)


class ExamAttemptExpiredError(AppError):
    def __init__(self) -> None:
        super().__init__("This exam attempt's time limit has passed and it was auto-submitted", 409)


class ExamAttemptAlreadyCompletedError(AppError):
    def __init__(self) -> None:
        super().__init__("This exam attempt is already completed", 409)


class NoExamSourceContentError(AppError):
    def __init__(self) -> None:
        super().__init__("There's no material in this topic yet to generate an exam from", 422)


class ExamGenerationParseError(AppError):
    def __init__(self) -> None:
        super().__init__("The AI tutor's exam response could not be parsed", 502)


class ExamNotEditableError(AppError):
    def __init__(self) -> None:
        super().__init__("Only draft exams can be edited", 409)


class ExamQuestionEditError(AppError):
    def __init__(self) -> None:
        super().__init__("The question edit doesn't match the question type", 422)
