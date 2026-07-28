from datetime import date, datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..ai import provider
from ..coach import service as coach_service
from ..mastery import service as mastery_service
from ..topics import service as topics_service
from . import prediction

STATUS_NARRATION_INSTRUCTIONS = """You are a supportive study coach giving a one-sentence exam-readiness
update. Given a topic name, a status (on_track, at_risk, or behind), the student's current readiness
percentage, and how many days remain, write ONE short, honest sentence (under 30 words). Do not invent
numbers not given to you. Plain text only, no markdown, no quotation marks."""


def _fallback_narration(topic_title: str, result: dict) -> str:
    status = result["status"]
    if status == prediction.STATUS_NO_DATA:
        return f"Not enough mastery data yet for {topic_title} -- study a bit and check back."
    if status == prediction.STATUS_NO_DEADLINE:
        readiness_pct = round(result["readiness"] * 100)
        return f"You're at {readiness_pct}% readiness in {topic_title}. Set an exam date to see a forecast."
    readiness_pct = round(result["readiness"] * 100)
    days = result["daysRemaining"]
    if status == prediction.STATUS_ON_TRACK:
        return f"You're on track for {topic_title} -- {readiness_pct}% ready with {days} day{'s' if days != 1 else ''} to go."
    if status == prediction.STATUS_AT_RISK:
        return f"You're at risk in {topic_title} -- {readiness_pct}% ready with only {days} day{'s' if days != 1 else ''} left. Pick up the pace."
    return f"You're behind in {topic_title} -- {readiness_pct}% ready with {days} day{'s' if days != 1 else ''} left. Consider more daily study time."


async def _narrate(topic_title: str, result: dict) -> str:
    fallback = _fallback_narration(topic_title, result)
    if result["status"] in (prediction.STATUS_NO_DATA,):
        return fallback
    prompt = (
        f"Topic: {topic_title}. Status: {result['status']}. "
        f"Readiness: {round(result['readiness'] * 100) if result['readiness'] is not None else 'unknown'}%. "
        f"Days remaining: {result['daysRemaining'] if result['daysRemaining'] is not None else 'no deadline set'}."
    )
    try:
        answer, _provider_name, _model_name = await provider.generate(prompt, instructions=STATUS_NARRATION_INSTRUCTIONS)
        return answer.strip() or fallback
    except Exception:
        return fallback


async def _predict_for_topic(db: AsyncSession, topic_id: int, topic_title: str, user_id: int, exam_date: date | None) -> dict:
    concepts = await mastery_service.list_all_concepts_with_mastery(db, topic_id, user_id)
    scores = [concept["masteryScore"] for concept in concepts]
    readiness = prediction.compute_readiness(scores)

    since = datetime.now(timezone.utc) - timedelta(days=prediction.TREND_WINDOW_DAYS)
    total_delta = await mastery_service.sum_recent_event_deltas_for_topic(db, topic_id, user_id, since)
    daily_gain_rate = prediction.compute_daily_gain_rate(total_delta, len(concepts), prediction.TREND_WINDOW_DAYS)

    result = prediction.predict_outcome(
        readiness=readiness, daily_gain_rate=daily_gain_rate, exam_date=exam_date, today=date.today(),
    )
    narrative = await _narrate(topic_title, result)
    return {
        "topicId": topic_id,
        "topicTitle": topic_title,
        "examDate": exam_date.isoformat() if exam_date else None,
        "conceptCount": len(concepts),
        **result,
        "narrative": narrative,
    }


async def get_prediction_for_topic(db: AsyncSession, topic_id: int, user_id: int) -> dict:
    topic = await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    goal = await coach_service.get_study_goal(db, topic_id, user_id)
    exam_date = date.fromisoformat(goal["examDate"]) if goal["examDate"] else None
    return await _predict_for_topic(db, topic_id, topic.title, user_id, exam_date)


async def list_predictions(db: AsyncSession, user_id: int) -> list[dict]:
    """One prediction per topic that has an exam date set -- topics without
    a goal have nothing to predict against."""
    goals = await coach_service.list_goals(db, user_id)
    goals_with_dates = [goal for goal in goals if goal.exam_date is not None]
    topics = await topics_service.list_topics(db, user_id)
    topic_titles = {topic.id: topic.title for topic in topics}

    predictions = []
    for goal in goals_with_dates:
        title = topic_titles.get(goal.topic_id)
        if title is None:
            continue
        predictions.append(await _predict_for_topic(db, goal.topic_id, title, user_id, goal.exam_date))
    predictions.sort(key=lambda item: (item["daysRemaining"] is None, item["daysRemaining"]))
    return predictions
