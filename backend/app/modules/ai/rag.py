import math
import re
from dataclasses import dataclass
from typing import Literal

from ...core.config import get_settings

TOKEN_RE = re.compile(r"[\w'-]+", re.UNICODE)

SourceType = Literal["note", "document"]


@dataclass
class ChunkRow:
    """A single already-chunked piece of content, from either a note or an
    uploaded document, as read from the `document_chunks` table."""

    chunk_id: int
    source_type: SourceType
    source_id: int
    source_title: str
    text: str


@dataclass
class ScoredChunk:
    chunk: ChunkRow
    score: float


def _tokens(text: str) -> list[str]:
    return [token.lower() for token in TOKEN_RE.findall(text) if len(token) > 1]


def score_bm25(
    question: str, chunks: list[ChunkRow], top_k: int | None = None
) -> list[ScoredChunk]:
    """Rank pre-chunked rows using BM25-style lexical relevance.

    Pure scoring -- chunking itself now happens once at write time
    (see `chunking.py`), not per chat request.
    """
    if not chunks:
        return []
    query_terms = set(_tokens(question))
    if not query_terms:
        return []

    tokenized = [(chunk, _tokens(chunk.text)) for chunk in chunks]
    document_frequency = {
        term: sum(1 for _, tokens in tokenized if term in set(tokens)) for term in query_terms
    }
    average_length = sum(len(tokens) for _, tokens in tokenized) / len(tokenized)

    scored: list[ScoredChunk] = []
    for chunk, tokens in tokenized:
        score = 0.0
        length = max(len(tokens), 1)
        for term in query_terms:
            frequency = tokens.count(term)
            if not frequency:
                continue
            inverse_frequency = math.log(
                1 + (len(tokenized) - document_frequency[term] + 0.5)
                / (document_frequency[term] + 0.5)
            )
            score += inverse_frequency * (
                frequency * 2.2
                / (frequency + 1.2 * (0.25 + 0.75 * length / average_length))
            )
        title_matches = len(query_terms.intersection(_tokens(chunk.source_title)))
        score += title_matches * 1.5
        if score > 0:
            scored.append(ScoredChunk(chunk, round(score, 4)))

    scored.sort(key=lambda item: item.score, reverse=True)
    return scored[: top_k or get_settings().rag_bm25_top_k]
