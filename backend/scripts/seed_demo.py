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
from app.modules.ai import indexing as ai_indexing
from app.modules.notes.model import Note
from app.modules.topics.model import Topic
from app.modules.users.model import User

DEMO_EMAIL = "demo@studia-demo.com"
LEGACY_DEMO_EMAIL = "demo@studia.local"
DEMO_PASSWORD = "studia-demo-2026"

# Several distinct concepts (not just one note) so retrieval has to actually
# discriminate between candidates -- both for a realistic tutor demo and so
# `docs/rag-evaluation.jsonl` (see scripts/evaluate_rag.py) is a meaningful
# eval set rather than a single-note topic where every query trivially hits
# the only chunk available.
DEMO_NOTES: list[tuple[str, str]] = [
    (
        "Photosynthesis",
        "Photosynthesis converts light energy into chemical energy. "
        "Chlorophyll absorbs light, and chloroplasts use carbon dioxide "
        "and water to produce glucose and oxygen.",
    ),
    (
        "Cellular Respiration",
        "Cellular respiration breaks down glucose in the presence of oxygen to "
        "release energy stored in ATP. It occurs in the mitochondria and includes "
        "glycolysis, the Krebs cycle, and the electron transport chain.",
    ),
    (
        "Mitosis and the Cell Cycle",
        "Mitosis is the process by which a single cell divides into two genetically "
        "identical daughter cells. The cell cycle includes interphase (growth and DNA "
        "replication) followed by prophase, metaphase, anaphase, and telophase.",
    ),
    (
        "DNA Replication",
        "DNA replication copies a cell's genome before division. Helicase unwinds the "
        "double helix, primase lays down primers, and DNA polymerase adds complementary "
        "nucleotides to each template strand, producing two identical DNA molecules.",
    ),
    (
        "Osmosis and Diffusion",
        "Diffusion is the passive movement of molecules from an area of high concentration "
        "to low concentration. Osmosis is the diffusion of water specifically across a "
        "semipermeable membrane, moving toward the side with higher solute concentration.",
    ),
    (
        "Enzymes and Catalysis",
        "Enzymes are biological catalysts that speed up chemical reactions by lowering the "
        "activation energy required. Each enzyme has an active site shaped to bind a specific "
        "substrate, and enzyme activity is sensitive to temperature and pH.",
    ),
    (
        "Homeostasis",
        "Homeostasis is the maintenance of a stable internal environment despite external "
        "changes. Feedback loops, most commonly negative feedback, regulate variables like "
        "body temperature, blood glucose, and pH within a narrow healthy range.",
    ),
]


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

        new_notes: list[Note] = []
        for title, content in DEMO_NOTES:
            existing = await db.scalar(
                select(Note).where(Note.topic_id == topic.id, Note.title == title)
            )
            if existing is None:
                note = Note(topic_id=topic.id, title=title, content=content)
                db.add(note)
                new_notes.append(note)

        await db.commit()

        # Index new notes immediately so they're retrievable right away --
        # `enqueue_note_index` indexes inline when REDIS_URL isn't set (the
        # local/dev default) and enqueues to the worker otherwise.
        for note in new_notes:
            await ai_indexing.enqueue_note_index(note.id)

        print(f"Demo account ready: {DEMO_EMAIL} / {DEMO_PASSWORD}")


async def main() -> None:
    try:
        await seed()
    finally:
        await dispose_engine()


if __name__ == "__main__":
    asyncio.run(main())
