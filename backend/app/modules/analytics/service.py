from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from ..gamification import repository as gamification_repository
from ..gamification import service as gamification_service
from ..gamification.leveling import level_progress
from ..mastery import service as mastery_service
from ..study_history import repository as study_history_repository
from ..topics import service as topics_service

TREND_DAYS = 7
WEAK_MASTERY_THRESHOLD = 0.4
STRONG_MASTERY_THRESHOLD = 0.75
WEAKEST_CONCEPTS_LIMIT = 5


def _activity_trend(daily_counts: dict[date, int], today: date) -> list[dict]:
    return [
        {
            "date": day.isoformat(),
            "count": daily_counts.get(day, 0),
        }
        for day in (today - timedelta(days=offset) for offset in range(TREND_DAYS - 1, -1, -1))
    ]


def _mastery_summary(concept_signals: list[mastery_service.ConceptSignal]) -> dict:
    if not concept_signals:
        return {
            "totalConcepts": 0,
            "averageMastery": None,
            "weakCount": 0,
            "strongCount": 0,
        }
    scores = [signal.mastery_score for signal in concept_signals]
    return {
        "totalConcepts": len(concept_signals),
        "averageMastery": round(sum(scores) / len(scores), 3),
        "weakCount": sum(1 for score in scores if score < WEAK_MASTERY_THRESHOLD),
        "strongCount": sum(1 for score in scores if score >= STRONG_MASTERY_THRESHOLD),
    }


def _weakest_concepts(concept_signals: list[mastery_service.ConceptSignal], topic_titles: dict[int, str]) -> list[dict]:
    ranked = sorted(concept_signals, key=lambda signal: signal.mastery_score)[:WEAKEST_CONCEPTS_LIMIT]
    return [
        {
            "conceptId": signal.concept_id,
            "conceptName": signal.concept_name,
            "topicId": signal.topic_id,
            "topicTitle": topic_titles.get(signal.topic_id, "Unknown topic"),
            "masteryScore": round(signal.mastery_score, 3),
        }
        for signal in ranked
    ]


def _topic_breakdown(
    topics: list,
    concept_signals: list[mastery_service.ConceptSignal],
    levels_by_topic: dict[int, int],
    concept_counts_by_topic: dict[int, int],
) -> list[dict]:
    scores_by_topic: dict[int, list[float]] = {}
    for signal in concept_signals:
        scores_by_topic.setdefault(signal.topic_id, []).append(signal.mastery_score)

    breakdown = []
    for topic in topics:
        scores = scores_by_topic.get(topic.id, [])
        total_xp = levels_by_topic.get(topic.id, 0)
        breakdown.append({
            "topicId": topic.id,
            "title": topic.title,
            "conceptCount": concept_counts_by_topic.get(topic.id, 0),
            "averageMastery": round(sum(scores) / len(scores), 3) if scores else None,
            "levelName": level_progress(total_xp).level_name,
            "totalXp": total_xp,
        })
    return breakdown


async def get_overview(db: AsyncSession, user_id: int) -> dict:
    today = date.today()
    stats = await study_history_repository.get_stats(db, user_id)
    daily_counts = await study_history_repository.daily_activity_counts(
        db, user_id, since=today - timedelta(days=TREND_DAYS - 1)
    )
    streak = await gamification_service.get_streak(db, user_id)
    levels = await gamification_repository.list_levels_for_user(db, user_id)
    levels_by_topic = {level.topic_id: level.total_xp for level in levels}
    total_xp = sum(level.total_xp for level in levels)

    topics = await topics_service.list_topics(db, user_id)
    topic_titles = {topic.id: topic.title for topic in topics}
    concept_signals = await mastery_service.list_all_concepts_for_planning(db, user_id)
    concept_counts_by_topic = await mastery_service.count_concepts_by_topic(db, [topic.id for topic in topics])

    return {
        "totalActivities": stats["total_activities"],
        "activitiesThisWeek": stats["activities_this_week"],
        "aiInteractions": stats["ai_interactions"],
        "topicsStudied": stats["topics_studied"],
        "currentStreak": streak["currentStreak"],
        "longestStreak": streak["longestStreak"],
        "totalXp": total_xp,
        "overallLevelName": level_progress(total_xp).level_name,
        "activityTrend": _activity_trend(daily_counts, today),
        "mastery": _mastery_summary(concept_signals),
        "weakestConcepts": _weakest_concepts(concept_signals, topic_titles),
        "topics": _topic_breakdown(topics, concept_signals, levels_by_topic, concept_counts_by_topic),
    }
