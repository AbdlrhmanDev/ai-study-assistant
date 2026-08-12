"""Evaluate hybrid retrieval against a small, human-labeled JSONL dataset.

Each line: {"topic_title": "Biology Foundations", "query": "...", "relevant_source_titles": ["Photosynthesis"]}
Source titles (not numeric ids) keep the dataset stable across environments --
ids depend on insertion order in whatever database the script runs against,
titles don't. `relevant_source_titles` is a list because a query may
legitimately be answered by more than one note/document.

Run from backend/ against a database seeded with `python scripts/seed_demo.py`:
    python scripts/evaluate_rag.py docs/rag-evaluation.jsonl
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.db.session import get_sessionmaker
from app.modules.ai.retrieval import hybrid_retrieve
from app.modules.topics.model import Topic
from app.modules.users.model import User

DEMO_EMAIL = "demo@studia-demo.com"


async def evaluate(path: Path) -> dict:
    examples = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    hits = 0
    reciprocal_rank = 0.0
    async with get_sessionmaker()() as db:
        demo_user_id = await db.scalar(select(User.id).where(User.email == DEMO_EMAIL))
        topic_ids: dict[str, int] = {}
        for example in examples:
            title = str(example["topic_title"])
            if title not in topic_ids:
                topic_id = await db.scalar(
                    select(Topic.id).where(Topic.user_id == demo_user_id, Topic.title == title)
                )
                if topic_id is None:
                    raise ValueError(f"No topic titled {title!r} for {DEMO_EMAIL} -- run scripts/seed_demo.py")
                topic_ids[title] = topic_id

            results = await hybrid_retrieve(db, topic_ids[title], str(example["query"]))
            relevant = {str(value) for value in example["relevant_source_titles"]}
            ranked_titles = [result.chunk.source_title for result in results]
            first_rank = next(
                (index for index, source_title in enumerate(ranked_titles, 1) if source_title in relevant),
                None,
            )
            if first_rank:
                hits += 1
                reciprocal_rank += 1 / first_rank
    total = len(examples)
    return {"examples": total, "recallAtK": round(hits / total, 4) if total else 0, "mrr": round(reciprocal_rank / total, 4) if total else 0}


if __name__ == "__main__":
    dataset = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/rag-evaluation.jsonl")
    print(json.dumps(asyncio.run(evaluate(dataset)), indent=2))
