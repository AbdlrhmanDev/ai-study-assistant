from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from ..ai import provider
from ..mastery import service as mastery_service
from ..topics import service as topics_service
from . import ranking, repository
from .exceptions import StudyPlanTaskNotFoundError
from .model import StudyGoal, StudyPlan, StudyPlanTask

COACH_NARRATION_INSTRUCTIONS = """You are an encouraging, concise study coach.
Given a short list of concepts the student should focus on today and a total time budget, write ONE short,
warm sentence (under 30 words) introducing today's plan. You may name at most 2 of the given concepts --
never invent a concept that isn't in the list. Plain text only, no markdown, no quotation marks."""


def _fallback_narrative(selected: list[ranking.RankedTask], total_minutes: int) -> str:
    if not selected:
        return "Nothing urgent today -- a great time to explore something new or review at your own pace."
    lead = selected[0].concept_name
    remainder = len(selected) - 1
    tail = f" and {remainder} more concept{'s' if remainder != 1 else ''}" if remainder else ""
    return f"Today's focus: {lead}{tail}, about {total_minutes} minutes total."


async def _narrate(selected: list[ranking.RankedTask], total_minutes: int) -> str:
    if not selected:
        return _fallback_narrative(selected, total_minutes)
    concept_names = ", ".join(task.concept_name for task in selected[:3])
    prompt = f"Concepts to focus on today: {concept_names}. Total time budget: {total_minutes} minutes."
    try:
        answer, _provider_name, _model_name = await provider.generate(prompt, instructions=COACH_NARRATION_INSTRUCTIONS)
        return answer.strip() or _fallback_narrative(selected, total_minutes)
    except Exception:
        return _fallback_narrative(selected, total_minutes)


def _serialize_task(task: StudyPlanTask) -> dict:
    return {
        "id": task.id,
        "topicId": task.topic_id,
        "conceptId": task.concept_id,
        "title": task.title,
        "estimatedMinutes": task.estimated_minutes,
        "orderIndex": task.order_index,
        "status": task.status,
    }


def _serialize_plan(plan: StudyPlan, tasks: list[StudyPlanTask]) -> dict:
    return {
        "id": plan.id,
        "planDate": plan.plan_date.isoformat(),
        "narrative": plan.narrative,
        "tasks": [_serialize_task(task) for task in tasks],
    }


async def set_study_goal(
    db: AsyncSession, topic_id: int, user_id: int, exam_date: date | None, available_minutes_per_day: int | None
) -> dict:
    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    goal = await repository.upsert_study_goal(
        db, user_id=user_id, topic_id=topic_id,
        exam_date=exam_date, available_minutes_per_day=available_minutes_per_day,
    )
    await db.commit()
    return _serialize_goal(goal)


def _serialize_goal(goal: StudyGoal) -> dict:
    return {
        "topicId": goal.topic_id,
        "examDate": goal.exam_date.isoformat() if goal.exam_date else None,
        "availableMinutesPerDay": goal.available_minutes_per_day,
    }


def serialize_goal(goal: StudyGoal) -> dict:
    return _serialize_goal(goal)


async def get_study_goal(db: AsyncSession, topic_id: int, user_id: int) -> dict:
    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    goal = await repository.get_study_goal(db, user_id, topic_id)
    if goal is None:
        return {"topicId": topic_id, "examDate": None, "availableMinutesPerDay": None}
    return _serialize_goal(goal)


async def list_goals(db: AsyncSession, user_id: int) -> list[StudyGoal]:
    return await repository.list_goals(db, user_id)


async def _generate_plan(db: AsyncSession, user_id: int, plan_date: date) -> StudyPlan:
    goals = await repository.list_goals(db, user_id)
    exam_dates_by_topic = {goal.topic_id: goal.exam_date for goal in goals}
    total_minutes = sum(
        goal.available_minutes_per_day for goal in goals if goal.available_minutes_per_day
    ) or ranking.DEFAULT_AVAILABLE_MINUTES

    concepts = await mastery_service.list_all_concepts_for_planning(db, user_id)
    concept_signals = [
        ranking.ConceptSignal(
            concept_id=c.concept_id, concept_name=c.concept_name,
            topic_id=c.topic_id, mastery_score=c.mastery_score,
        )
        for c in concepts
    ]
    ranked = ranking.rank_concepts(concept_signals, exam_dates_by_topic, plan_date)
    selected = ranking.select_for_budget(ranked, total_minutes)

    narrative = await _narrate(selected, total_minutes)
    plan = await repository.replace_plan_for_date(db, user_id=user_id, plan_date=plan_date, narrative=narrative)
    for order_index, task in enumerate(selected):
        await repository.create_task(
            db, plan_id=plan.id, topic_id=task.topic_id, concept_id=task.concept_id,
            title=f"Review {task.concept_name}", estimated_minutes=ranking.MINUTES_PER_TASK,
            order_index=order_index,
        )
    await db.commit()
    return plan


async def get_today_plan(db: AsyncSession, user_id: int) -> dict:
    today = date.today()
    existing = await repository.get_plan_for_date(db, user_id, today)
    if existing is not None:
        tasks = await repository.list_tasks_for_plan(db, existing.id)
        return _serialize_plan(existing, tasks)
    plan = await _generate_plan(db, user_id, today)
    tasks = await repository.list_tasks_for_plan(db, plan.id)
    return _serialize_plan(plan, tasks)


async def regenerate_today_plan(db: AsyncSession, user_id: int) -> dict:
    today = date.today()
    plan = await _generate_plan(db, user_id, today)
    tasks = await repository.list_tasks_for_plan(db, plan.id)
    return _serialize_plan(plan, tasks)


async def update_task_status(db: AsyncSession, task_id: int, user_id: int, status: str) -> dict:
    task = await repository.get_task_for_user(db, task_id, user_id)
    if task is None:
        raise StudyPlanTaskNotFoundError()
    task = await repository.set_task_status(db, task, status)
    await db.commit()
    return _serialize_task(task)


async def get_reflection(db: AsyncSession, user_id: int, plan_date: date) -> dict:
    plan = await repository.get_plan_for_date(db, user_id, plan_date)
    if plan is None:
        return {"planDate": plan_date.isoformat(), "reflection": None, "completed": 0, "total": 0}
    tasks = await repository.list_tasks_for_plan(db, plan.id)
    total = len(tasks)
    completed = sum(1 for task in tasks if task.status == "completed")
    if total == 0:
        reflection = None
    elif completed == 0:
        reflection = "No tasks completed yet today -- there's still time."
    elif completed == total:
        reflection = f"You completed all {total} of today's planned tasks. Nice work."
    else:
        reflection = f"You completed {completed} of {total} planned tasks today."
    return {"planDate": plan_date.isoformat(), "reflection": reflection, "completed": completed, "total": total}
