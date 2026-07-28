from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import get_settings
from ...core.exceptions import AppError
from ..gamification import service as gamification_service
from ..mastery import service as mastery_service
from ..memory import indexing as memory_indexing
from ..memory import service as memory_service
from ..study_history import repository as study_history_repository
from ..topics import service as topics_service
from . import indexing, provider, repository, retrieval, sparring, text_extraction
from .exceptions import (
    DocumentNotFoundError,
    DocumentNotReadyError,
    EmptyAiResponseError,
    FileTooLargeError,
    UnsupportedFileTypeError,
)
from .model import ChatMessage, Document
from .schema import SourceOut
from .storage import get_storage_backend

MODEL_HISTORY_LIMIT = 10
SUPPORTED_IMAGE_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}


def _serialize_message(message: ChatMessage) -> dict:
    return {
        "id": message.id,
        "topic_id": message.topic_id,
        "role": message.role,
        "message": message.message,
        "mode": message.mode,
        "created_at": message.created_at.isoformat(),
    }


async def chat_with_tutor(
    db: AsyncSession,
    topic_id: int,
    user_id: int,
    question: str,
    document_id: int | None = None,
    background_tasks: BackgroundTasks | None = None,
) -> dict:
    topic = await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    history_rows = await repository.find_recent_by_topic(db, topic_id, MODEL_HISTORY_LIMIT)
    history_dicts = [{"role": message.role, "message": message.message} for message in history_rows]
    topic_dict = {"title": topic.title, "description": topic.description}
    student_context = await memory_service.get_prompt_context(db, user_id)

    if document_id is not None:
        document = await repository.get_document_for_topic(db, document_id, topic_id)
        if document is None:
            raise DocumentNotFoundError()
        if document.status != "completed":
            raise DocumentNotReadyError(document.status)

    retrieved_chunks = await retrieval.hybrid_retrieve(db, topic_id, question, document_id=document_id)

    try:
        answer, provider_name, model_name = await provider.generate(
            provider.build_input(topic_dict, retrieved_chunks, history_dicts, question, student_context)
        )
    except AppError:
        raise
    except Exception as error:
        raise AppError(
            "AI tutor is temporarily unavailable", 502, {"cause": str(error)}
        ) from error

    answer = answer.strip()
    if not answer:
        raise EmptyAiResponseError()

    messages = await repository.create_exchange(db, topic_id, question, answer)
    await repository.record_message_sources(
        db,
        message_id=messages["assistantMessage"].id,
        sources=[
            (retrieved.chunk.chunk_id, retrieved.similarity) for retrieved in retrieved_chunks
        ],
    )
    await study_history_repository.record_activity_safely(
        db,
        user_id=user_id,
        topic_id=topic_id,
        activity_type="ai_chat",
        description=f"Asked AI tutor about: {topic.title}",
    )
    await gamification_service.record_graded_action(db, user_id)
    await db.commit()

    if background_tasks is not None:
        memory_indexing.extract_memory_in_background(background_tasks, user_id, question, answer)

    return {
        "answer": answer,
        "provider": provider_name,
        "model": model_name,
        "usedMemory": bool(student_context.strip()),
        "messages": {
            "userMessage": _serialize_message(messages["userMessage"]),
            "assistantMessage": _serialize_message(messages["assistantMessage"]),
        },
        "sources": [
            SourceOut(
                sourceType=retrieved.chunk.source_type,
                sourceId=retrieved.chunk.source_id,
                sourceTitle=retrieved.chunk.source_title,
                excerpt=retrieved.chunk.text[:400],
                score=retrieved.score,
                similarity=retrieved.similarity,
            ).model_dump()
            for retrieved in retrieved_chunks
        ],
    }


async def chat_with_tutor_image(
    db: AsyncSession,
    topic_id: int,
    user_id: int,
    question: str,
    image_bytes: bytes,
    content_type: str,
    background_tasks: BackgroundTasks | None = None,
) -> dict:
    if content_type not in SUPPORTED_IMAGE_CONTENT_TYPES:
        raise UnsupportedFileTypeError(content_type)
    settings = get_settings()
    if len(image_bytes) > settings.max_upload_bytes:
        raise FileTooLargeError(settings.max_upload_mb)

    topic = await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    history_rows = await repository.find_recent_by_topic(db, topic_id, MODEL_HISTORY_LIMIT)
    history_dicts = [{"role": message.role, "message": message.message} for message in history_rows]
    topic_dict = {"title": topic.title, "description": topic.description}
    student_context = await memory_service.get_prompt_context(db, user_id)

    prompt = provider.build_image_input(topic_dict, history_dicts, question, student_context)
    try:
        answer, provider_name, model_name = await provider.generate_with_image(prompt, image_bytes, content_type)
    except AppError:
        raise
    except Exception as error:
        raise AppError(
            "AI tutor is temporarily unavailable", 502, {"cause": str(error)}
        ) from error

    answer = answer.strip()
    if not answer:
        raise EmptyAiResponseError()

    stored_question = f"[Image attached] {question.strip()}" if question.strip() else "[Image attached]"
    messages = await repository.create_exchange(db, topic_id, stored_question, answer, mode="image")
    await study_history_repository.record_activity_safely(
        db, user_id=user_id, topic_id=topic_id, activity_type="ai_chat",
        description=f"Asked AI tutor about an image in: {topic.title}",
    )
    await gamification_service.record_graded_action(db, user_id)
    await db.commit()

    if background_tasks is not None:
        memory_indexing.extract_memory_in_background(background_tasks, user_id, stored_question, answer)

    return {
        "answer": answer,
        "provider": provider_name,
        "model": model_name,
        "messages": {
            "userMessage": _serialize_message(messages["userMessage"]),
            "assistantMessage": _serialize_message(messages["assistantMessage"]),
        },
    }


async def spar_with_tutor(
    db: AsyncSession,
    topic_id: int,
    user_id: int,
    message: str,
    concept: str,
    spar_start: bool,
    background_tasks: BackgroundTasks | None = None,
) -> dict:
    topic = await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    topic_dict = {"title": topic.title, "description": topic.description}
    student_context = await memory_service.get_prompt_context(db, user_id)

    if spar_start:
        history_dicts: list[dict] = []
        force_concede = False
    else:
        history_rows = await repository.find_recent_sparring_run(db, topic_id, MODEL_HISTORY_LIMIT)
        history_dicts = [{"role": row.role, "message": row.message} for row in history_rows]
        assistant_turns_so_far = sum(1 for row in history_dicts if row["role"] == "assistant")
        force_concede = sparring.should_force_concede(assistant_turns_so_far)

    retrieved_chunks = await retrieval.hybrid_retrieve(db, topic_id, concept)
    instructions = provider.SPARRING_CONCEDE_INSTRUCTIONS if force_concede else provider.SPARRING_INSTRUCTIONS

    try:
        raw_answer, provider_name, model_name = await provider.generate(
            provider.build_sparring_input(
                topic_dict, retrieved_chunks, concept, history_dicts, message, spar_start, student_context,
            ),
            instructions=instructions,
        )
    except AppError:
        raise
    except Exception as error:
        raise AppError(
            "AI tutor is temporarily unavailable", 502, {"cause": str(error)}
        ) from error

    answer, verdict = sparring.parse_verdict(raw_answer)
    if force_concede:
        verdict = "concede"
    if not answer:
        raise EmptyAiResponseError()

    user_message_text = concept if spar_start else message
    messages = await repository.create_exchange(
        db, topic_id, user_message_text, answer, mode="sparring"
    )

    sparring_award = None
    milestone_award = None
    if verdict == "concede":
        mastery_result = await mastery_service.record_mastery_event(
            db, user_id=user_id, topic_id=topic_id, concept_name=concept,
            source_type="sparring", source_id=messages["assistantMessage"].id, quality=1.0,
        )
        milestone_award = mastery_result.milestone_award
        sparring_award = await gamification_service.award_sparring_xp(
            db, user_id=user_id, topic_id=topic_id, source_id=messages["assistantMessage"].id,
        )

    await study_history_repository.record_activity_safely(
        db,
        user_id=user_id,
        topic_id=topic_id,
        activity_type="ai_chat",
        description=f"Sparred with AI tutor about: {concept}",
    )
    await gamification_service.record_graded_action(db, user_id)
    await db.commit()

    if background_tasks is not None:
        memory_indexing.extract_memory_in_background(background_tasks, user_id, user_message_text, answer)

    return {
        "answer": answer,
        "verdict": verdict,
        "concept": concept,
        "provider": provider_name,
        "model": model_name,
        "usedMemory": bool(student_context.strip()),
        "messages": {
            "userMessage": _serialize_message(messages["userMessage"]),
            "assistantMessage": _serialize_message(messages["assistantMessage"]),
        },
        **gamification_service.summarize_awards(sparring_award, milestone_award),
    }


async def get_message_history(
    db: AsyncSession, topic_id: int, user_id: int, limit: int
) -> list[dict]:
    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    messages = await repository.find_recent_by_topic(db, topic_id, limit)
    return [_serialize_message(message) for message in messages]


async def clear_message_history(db: AsyncSession, topic_id: int, user_id: int) -> int:
    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    deleted = await repository.delete_all_by_topic(db, topic_id)
    await db.commit()
    return deleted


# --------------------------------------------------------------------------
# Documents
# --------------------------------------------------------------------------


async def create_document(
    db: AsyncSession,
    background_tasks: BackgroundTasks,
    topic_id: int,
    user_id: int,
    *,
    filename: str,
    content_type: str,
    raw_bytes: bytes,
    title: str | None = None,
) -> Document:
    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)

    settings = get_settings()
    if content_type not in text_extraction.SUPPORTED_CONTENT_TYPES:
        raise UnsupportedFileTypeError(content_type)
    if len(raw_bytes) > settings.max_upload_bytes:
        raise FileTooLargeError(settings.max_upload_mb)

    document = await repository.create_document(
        db,
        topic_id=topic_id,
        title=title or filename,
        original_filename=filename,
        content_type=content_type,
    )
    await db.commit()
    await db.refresh(document)

    storage = get_storage_backend()
    storage_path = storage.save(f"{document.id}/{filename}", raw_bytes)
    await repository.set_document_storage_path(db, document.id, storage_path)
    await db.commit()
    await db.refresh(document)

    indexing.index_document_in_background(background_tasks, document.id)
    return document


async def get_document(db: AsyncSession, document_id: int, user_id: int) -> Document:
    document = await repository.get_document(db, document_id)
    if document is None:
        raise DocumentNotFoundError()
    await topics_service.get_owned_topic_or_404(db, document.topic_id, user_id)
    return document


async def list_documents(db: AsyncSession, topic_id: int, user_id: int) -> list[Document]:
    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    return await repository.list_documents_by_topic(db, topic_id)


async def delete_document(db: AsyncSession, document_id: int, user_id: int) -> None:
    document = await get_document(db, document_id, user_id)
    storage = get_storage_backend()
    if document.storage_path:
        storage.delete(document.storage_path)
    await repository.delete_document(db, document)
    await db.commit()
