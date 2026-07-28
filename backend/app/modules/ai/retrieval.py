from dataclasses import dataclass

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import get_settings
from . import repository
from .embedding import generate_embedding
from .rag import ChunkRow, score_bm25

logger = structlog.get_logger("study_assistant")


@dataclass
class RetrievedChunk:
    """A chunk selected for the AI prompt, with its fused relevance score
    and (when found via vector search) a raw cosine-similarity score."""

    chunk: ChunkRow
    score: float
    similarity: float | None


def _reciprocal_rank_fusion(*ranked_lists: list[ChunkRow], rrf_k: int) -> dict[int, float]:
    """Combine independently-ranked lists into one fused score per chunk id:
    score = sum(1 / (rrf_k + rank)) across every list containing that chunk
    (rank is 1-indexed). Standard, weight-free hybrid-search fusion."""
    fused: dict[int, float] = {}
    for ranked in ranked_lists:
        for rank, chunk in enumerate(ranked, start=1):
            fused[chunk.chunk_id] = fused.get(chunk.chunk_id, 0.0) + 1 / (rrf_k + rank)
    return fused


async def hybrid_retrieve(
    db: AsyncSession,
    topic_id: int,
    question: str,
    top_k: int | None = None,
    document_id: int | None = None,
) -> list[RetrievedChunk]:
    """Vector similarity search + BM25, fused via Reciprocal Rank Fusion.

    Falls back to BM25 alone if embedding generation or the pgvector query
    fails (provider outage, pgvector unavailable, nothing indexed yet) --
    chat should degrade gracefully, never hard-fail because of retrieval.

    `document_id`, when set, narrows the whole candidate pool (both BM25 and
    vector) to a single document -- the user picked it via the tutor's "/"
    document picker instead of asking about the topic as a whole.
    """
    settings = get_settings()
    final_k = top_k or settings.rag_top_k

    topic_chunks = await repository.list_topic_chunks(db, topic_id, document_id=document_id)
    bm25_results = score_bm25(question, topic_chunks, top_k=settings.rag_bm25_top_k)
    bm25_ranked = [scored.chunk for scored in bm25_results]

    vector_hits: list[tuple[ChunkRow, float]] = []
    try:
        query_embedding = await generate_embedding(question)
        vector_hits = await repository.vector_search(
            db, topic_id, query_embedding, settings.rag_vector_top_k, document_id=document_id
        )
    except Exception:
        logger.warning(
            "vector_search_failed_falling_back_to_bm25", topic_id=topic_id, exc_info=True
        )

    if not vector_hits:
        return [
            RetrievedChunk(chunk=scored.chunk, score=scored.score, similarity=None)
            for scored in bm25_results[:final_k]
        ]

    vector_ranked = [chunk for chunk, _similarity in vector_hits]
    similarity_by_id = {chunk.chunk_id: similarity for chunk, similarity in vector_hits}
    chunks_by_id = {chunk.chunk_id: chunk for chunk in (*bm25_ranked, *vector_ranked)}

    fused_scores = _reciprocal_rank_fusion(bm25_ranked, vector_ranked, rrf_k=settings.rag_rrf_k)
    ranked_ids = sorted(fused_scores, key=lambda chunk_id: fused_scores[chunk_id], reverse=True)

    return [
        RetrievedChunk(
            chunk=chunks_by_id[chunk_id],
            score=fused_scores[chunk_id],
            similarity=similarity_by_id.get(chunk_id),
        )
        for chunk_id in ranked_ids[:final_k]
    ]
