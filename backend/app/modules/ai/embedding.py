import time

from fastapi.concurrency import run_in_threadpool

from ...core.config import get_settings
from ...core.exceptions import AppError


def _embed_gemini_sync(texts: list[str]) -> list[list[float]]:
    from google import genai
    from google.genai import types

    settings = get_settings()
    if not settings.gemini_api_key:
        raise AppError("GEMINI_API_KEY is not configured", 503)
    client = genai.Client(api_key=settings.gemini_api_key)
    result = client.models.embed_content(
        model=settings.gemini_embedding_model,
        contents=texts,
        config=types.EmbedContentConfig(output_dimensionality=settings.embedding_dimensions),
    )
    return [embedding.values for embedding in result.embeddings]


def _embed_openai_sync(texts: list[str]) -> list[list[float]]:
    from openai import OpenAI

    settings = get_settings()
    if not settings.openai_api_key:
        raise AppError("OPENAI_API_KEY is not configured", 503)
    client = OpenAI(api_key=settings.openai_api_key)
    response = client.embeddings.create(
        model=settings.openai_embedding_model,
        input=texts,
        dimensions=settings.embedding_dimensions,
    )
    return [item.embedding for item in response.data]


async def generate_embeddings(texts: list[str], *, user_id: int | None = None) -> list[list[float]]:
    """Batch-embed chunk texts using the configured EMBEDDING_PROVIDER.

    Independent of AI_PROVIDER (used for chat) since Groq has no embeddings
    API. Runs the (synchronous) SDK call in a threadpool, matching
    `provider.py`'s pattern for the chat-completion calls.

    `user_id` is explicit rather than the usual usage-metering contextvar:
    embeddings run from indexing jobs (`ai/indexing.py`), which execute
    outside any HTTP request and so never had the contextvar set.
    """
    if not texts:
        return []
    settings = get_settings()
    embed = _embed_gemini_sync if settings.embedding_provider == "gemini" else _embed_openai_sync
    model = settings.embedding_model

    if user_id is None:
        return await run_in_threadpool(embed, texts)

    from ..usage import service as usage_service

    await usage_service.enforce_quota("embeddings", user_id=user_id)
    started = time.perf_counter()
    combined = "\n".join(texts)
    try:
        result = await run_in_threadpool(embed, texts)
    except Exception:
        await usage_service.record(
            provider=settings.embedding_provider, model=model, prompt=combined, output="",
            latency_ms=round((time.perf_counter() - started) * 1000),
            outcome="failed", feature="embeddings", user_id=user_id,
        )
        raise
    await usage_service.record(
        provider=settings.embedding_provider, model=model, prompt=combined, output="",
        latency_ms=round((time.perf_counter() - started) * 1000),
        feature="embeddings", user_id=user_id,
    )
    return result


async def generate_embedding(text: str) -> list[float]:
    """Embed a single piece of text (e.g. the user's chat question)."""
    (embedding,) = await generate_embeddings([text])
    return embedding
