from ...core.exceptions import AppError


class InvalidLearningStyleWeightsError(AppError):
    def __init__(self) -> None:
        super().__init__("Weights must cover all six axes with non-negative values", 422)
