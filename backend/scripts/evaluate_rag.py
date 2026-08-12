"""Evaluate hybrid retrieval against a small, human-labeled JSONL dataset.

Each line: {"topic_id": 1, "query": "...", "relevant_source_ids": [12, 19]}
Run from backend/: python scripts/evaluate_rag.py docs/rag-evaluation.example.jsonl
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import get_sessionmaker
from app.modules.ai.retrieval import hybrid_retrieve


async def evaluate(path: Path) -> dict:
    examples = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    hits = 0
    reciprocal_rank = 0.0
    async with get_sessionmaker()() as db:
        for example in examples:
            results = await hybrid_retrieve(db, int(example["topic_id"]), str(example["query"]))
            relevant = {int(value) for value in example["relevant_source_ids"]}
            ranked = [result.chunk.source_id for result in results]
            first_rank = next((index for index, source_id in enumerate(ranked, 1) if source_id in relevant), None)
            if first_rank:
                hits += 1
                reciprocal_rank += 1 / first_rank
    total = len(examples)
    return {"examples": total, "recallAtK": round(hits / total, 4) if total else 0, "mrr": round(reciprocal_rank / total, 4) if total else 0}


if __name__ == "__main__":
    dataset = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/rag-evaluation.example.jsonl")
    print(json.dumps(asyncio.run(evaluate(dataset)), indent=2))
