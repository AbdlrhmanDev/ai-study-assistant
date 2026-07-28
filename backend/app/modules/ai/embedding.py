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


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Batch-embed chunk texts using the configured EMBEDDING_PROVIDER.

    Independent of AI_PROVIDER (used for chat) since Groq has no embeddings
    API. Runs the (synchronous) SDK call in a threadpool, matching
    `provider.py`'s pattern for the chat-completion calls.
    """
    if not texts:
        return []
    settings = get_settings()
    embed = _embed_gemini_sync if settings.embedding_provider == "gemini" else _embed_openai_sync
    return await run_in_threadpool(embed, texts)


async def generate_embedding(text: str) -> list[float]:
    """Embed a single piece of text (e.g. the user's chat question)."""
    (embedding,) = await generate_embeddings([text])
    return embedding
