"""Create an idempotent local demo account with starter study content."""

import asyncio
import sys
from pathlib import Path

# Support both documented module execution (`python -m scripts.seed_demo`)
# and direct execution (`python scripts/seed_demo.py`). When a script is run
# directly, Python otherwise adds only the scripts directory to sys.path and
# cannot resolve the sibling `app` package.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import get_sessionmaker, dispose_engine
from app.modules.notes.model import Note
from app.modules.topics.model import Topic
from app.modules.users.model import User

DEMO_EMAIL = "demo@studia-demo.com"
LEGACY_DEMO_EMAIL = "demo@studia.local"
DEMO_PASSWORD = "studia-demo-2026"


async def seed() -> None:
    async with get_sessionmaker()() as db:
        user = await db.scalar(
            select(User).where(User.email.in_((DEMO_EMAIL, LEGACY_DEMO_EMAIL)))
        )
        if user is None:
            user = User(
                name="Studia Demo Learner",
                email=DEMO_EMAIL,
                password_hash=await hash_password(DEMO_PASSWORD),
            )
            db.add(user)
            await db.flush()
        elif user.email == LEGACY_DEMO_EMAIL:
            # `.local` is intentionally rejected by Pydantic's EmailStr, so
            # migrate accounts created by older versions of this seed.
            user.email = DEMO_EMAIL

        topic = await db.scalar(
            select(Topic).where(Topic.user_id == user.id, Topic.title == "Biology Foundations")
        )
        if topic is None:
            topic = Topic(
                user_id=user.id,
                title="Biology Foundations",
                description="Starter material for exploring Studia's learning workflows.",
            )
            db.add(topic)
            await db.flush()

        note = await db.scalar(
            select(Note).where(Note.topic_id == topic.id, Note.title == "Photosynthesis")
        )
        if note is None:
            db.add(
                Note(
                    topic_id=topic.id,
                    title="Photosynthesis",
                    content=(
                        "Photosynthesis converts light energy into chemical energy. "
                        "Chlorophyll absorbs light, and chloroplasts use carbon dioxide "
                        "and water to produce glucose and oxygen."
                    ),
                )
            )

        await db.commit()
        print(f"Demo account ready: {DEMO_EMAIL} / {DEMO_PASSWORD}")


async def main() -> None:
    try:
        await seed()
    finally:
        await dispose_engine()


if __name__ == "__main__":
    asyncio.run(main())
