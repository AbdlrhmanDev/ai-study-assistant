"""Pure exam-readiness prediction. Deliberately deterministic -- no LLM in
the inference itself, only (optionally) in how the result gets narrated to
the student. Readiness and trend are both plain arithmetic over mastery
data that already exists elsewhere."""

from datetime import date

TARGET_MASTERY = 0.8
TREND_WINDOW_DAYS = 14

STATUS_NO_DATA = "no_data"
STATUS_NO_DEADLINE = "no_deadline"
STATUS_ON_TRACK = "on_track"
STATUS_AT_RISK = "at_risk"
STATUS_BEHIND = "behind"


def compute_readiness(concept_mastery_scores: list[float]) -> float | None:
    if not concept_mastery_scores:
        return None
    return sum(concept_mastery_scores) / len(concept_mastery_scores)


def compute_daily_gain_rate(total_delta: float, concept_count: int, window_days: int = TREND_WINDOW_DAYS) -> float:
    if concept_count <= 0 or window_days <= 0:
        return 0.0
    return total_delta / concept_count / window_days


def predict_outcome(
    *,
    readiness: float | None,
    daily_gain_rate: float,
    exam_date: date | None,
    today: date,
    target: float = TARGET_MASTERY,
) -> dict:
    if readiness is None:
        return {
            "status": STATUS_NO_DATA,
            "readiness": None,
            "predictedMastery": None,
            "requiredDailyGain": None,
            "daysRemaining": None,
        }

    if exam_date is None:
        return {
            "status": STATUS_NO_DEADLINE,
            "readiness": round(readiness, 3),
            "predictedMastery": None,
            "requiredDailyGain": None,
            "daysRemaining": None,
        }

    days_remaining = (exam_date - today).days
    if days_remaining <= 0:
        status = STATUS_ON_TRACK if readiness >= target else STATUS_BEHIND
        return {
            "status": status,
            "readiness": round(readiness, 3),
            "predictedMastery": round(readiness, 3),
            "requiredDailyGain": None,
            "daysRemaining": days_remaining,
        }

    predicted = min(1.0, max(0.0, readiness + daily_gain_rate * days_remaining))
    required_daily_gain = max(0.0, (target - readiness) / days_remaining)

    if predicted >= target:
        status = STATUS_ON_TRACK
    elif daily_gain_rate > 0 and daily_gain_rate >= required_daily_gain * 0.75:
        status = STATUS_AT_RISK
    else:
        status = STATUS_BEHIND

    return {
        "status": status,
        "readiness": round(readiness, 3),
        "predictedMastery": round(predicted, 3),
        "requiredDailyGain": round(required_daily_gain, 4),
        "daysRemaining": days_remaining,
    }
