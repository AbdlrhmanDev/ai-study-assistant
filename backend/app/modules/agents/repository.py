from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import AgentSession, AgentStep


async def create_session(
    db: AsyncSession, *, user_id: int, topic_id: int | None, goal: str
) -> AgentSession:
    session = AgentSession(user_id=user_id, topic_id=topic_id, goal=goal, status="completed")
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


async def set_session_status(db: AsyncSession, session: AgentSession, status: str) -> AgentSession:
    session.status = status
    await db.flush()
    return session


async def create_step(
    db: AsyncSession, *, session_id: int, step_index: int, agent_type: str,
    tool_used: str | None, input: str, output: str,
) -> AgentStep:
    step = AgentStep(
        session_id=session_id, step_index=step_index, agent_type=agent_type,
        tool_used=tool_used, input=input, output=output,
    )
    db.add(step)
    await db.flush()
    return step


async def get_session_for_user(db: AsyncSession, session_id: int, user_id: int) -> AgentSession | None:
    stmt = select(AgentSession).where(AgentSession.id == session_id, AgentSession.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_steps(db: AsyncSession, session_id: int) -> list[AgentStep]:
    stmt = select(AgentStep).where(AgentStep.session_id == session_id).order_by(AgentStep.step_index)
    result = await db.execute(stmt)
    return list(result.scalars().all())
