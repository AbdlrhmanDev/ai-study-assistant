import structlog
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
    ChatMessageNotFoundError,
    DocumentNotFoundError,
    DocumentNotReadyError,
    EmptyAiResponseError,
    FileTooLargeError,
    StorageQuotaExceededError,
    UnsupportedFileTypeError,
)
from .model import ChatMessage, Document
from .schema import SourceOut
from .storage import get_storage_backend
from .storage_keys import document_key

logger = structlog.get_logger("study_assistant")

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
    from ..growth.service import add_event
    add_event(db, user_id, "first_ai_answer", {"topicId": topic_id, "messageId": messages["assistantMessage"].id})
    await db.commit()

    if background_tasks is not None:
        await memory_indexing.enqueue_memory_extraction(user_id, question, answer)

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
        await memory_indexing.enqueue_memory_extraction(user_id, stored_question, answer)

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
        await memory_indexing.enqueue_memory_extraction(user_id, user_message_text, answer)

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


async def submit_message_feedback(
    db: AsyncSession, message_id: int, user_id: int, rating: int, reason: str | None,
    comment: str | None = None,
) -> dict:
    owned = await repository.get_message_with_owner(db, message_id)
    if owned is None or owned[1] != user_id:
        raise ChatMessageNotFoundError()
    feedback = await repository.upsert_message_feedback(
        db, message_id=message_id, rating=rating, reason=reason
    )
    # AnswerFeedback (commentable, powers answer-quality funnels) is the
    # growth analytics home for the same event; write it on the canonical
    # path so `comment` is actually reachable instead of being shadowed.
    from ..growth.service import rate_answer
    await rate_answer(db, user_id, message_id, rating, reason, comment)
    return {
        "feedback": {
            "messageId": feedback.message_id, "rating": feedback.rating, "reason": feedback.reason,
        }
    }


async def record_source_click(
    db: AsyncSession, message_id: int, user_id: int, *,
    source_type: str, source_id: int, score: float | None = None,
) -> None:
    """Telemetry for which cited source a user opened. Whether cited chunks
    are actually clicked is the closest proxy for "was the answer grounded in
    the right material" that exists today; it feeds the source_click funnel."""
    owned = await repository.get_message_with_owner(db, message_id)
    if owned is None or owned[1] != user_id:
        raise ChatMessageNotFoundError()
    from ..growth.service import add_event
    add_event(db, user_id, "source_click", {
        "messageId": message_id,
        "sourceType": source_type,
        "sourceId": source_id,
        "score": score,
    })
    await db.commit()


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
    if len(raw_bytes) > settings.max_upload_bytes:
        raise FileTooLargeError(settings.max_upload_mb)
    from ..plans.service import plan_limits_for_user
    plan = await plan_limits_for_user(db, user_id)
    storage_limit_bytes = plan["storageBytes"]
    current_usage = await repository.sum_document_bytes_for_user(db, user_id)
    if current_usage + len(raw_bytes) > storage_limit_bytes:
        raise StorageQuotaExceededError(int(storage_limit_bytes // (1024 * 1024)))
    from .upload_security import scan_for_malware, validate_document
    content_type = validate_document(filename, content_type, raw_bytes)
    scan_for_malware(raw_bytes)

    document = await repository.create_document(
        db,
        topic_id=topic_id,
        title=title or filename,
        original_filename=filename,
        content_type=content_type,
        file_size_bytes=len(raw_bytes),
    )
    await db.commit()
    await db.refresh(document)

    storage = get_storage_backend()
    from pathlib import Path
    safe_suffix = Path(filename).suffix.lower()
    storage_path = storage.save(
        document_key(user_id, document.id, safe_suffix), raw_bytes, content_type
    )
    await repository.set_document_storage_path(db, document.id, storage_path)
    from ..growth.service import add_event
    add_event(db, user_id, "first_upload", {"topicId": topic_id, "documentId": document.id})
    await db.commit()
    await db.refresh(document)

    await indexing.enqueue_document_index(document.id)
    return document


async def retry_document_index(db: AsyncSession, document_id: int, user_id: int) -> Document:
    document = await get_document(db, document_id, user_id)
    await repository.update_document_status(db, document.id, status="pending")
    await db.commit()
    await indexing.enqueue_document_index(document.id)
    await db.refresh(document)
    return document


async def get_document_download_url(db: AsyncSession, document_id: int, user_id: int) -> str:
    document = await get_document(db, document_id, user_id)
    if not document.storage_path:
        raise DocumentNotReadyError(document.status)
    url = get_storage_backend().signed_download_url(document.storage_path)
    if not url:
        raise AppError("Signed downloads are available with object storage", 409)
    return url


async def get_document(db: AsyncSession, document_id: int, user_id: int) -> Document:
    document = await repository.get_document(db, document_id)
    if document is None:
        raise DocumentNotFoundError()
    await topics_service.get_owned_topic_or_404(db, document.topic_id, user_id)
    return document


async def list_documents(db: AsyncSession, topic_id: int, user_id: int) -> list[Document]:
    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    return await repository.list_documents_by_topic(db, topic_id)


async def get_storage_usage(db: AsyncSession, user_id: int) -> dict:
    from ..plans.service import plan_limits_for_user
    plan = await plan_limits_for_user(db, user_id)
    used_bytes = await repository.sum_document_bytes_for_user(db, user_id)
    return {
        "usedBytes": used_bytes,
        "limitBytes": plan["storageBytes"],
        "plan": plan["plan"],
    }


PREVIEW_CHAR_LIMIT = 20_000


async def get_document_preview(db: AsyncSession, document_id: int, user_id: int) -> dict:
    """The document's extracted text, truncated to a sane preview length --
    this is what the AI tutor actually indexed, not a rendered facsimile of
    the original file, so it doubles as a way to sanity-check what the tutor
    can "see" from a given upload."""
    document = await get_document(db, document_id, user_id)
    if document.status != "completed" or document.extracted_text is None:
        return {"text": None, "truncated": False, "status": document.status}
    text = document.extracted_text
    truncated = len(text) > PREVIEW_CHAR_LIMIT
    return {"text": text[:PREVIEW_CHAR_LIMIT], "truncated": truncated, "status": document.status}


async def delete_document(db: AsyncSession, document_id: int, user_id: int) -> None:
    """Idempotent: retrying after a previous storage-side failure still
    removes the DB row (and cascaded chunks) instead of getting stuck --
    an object that's already gone, or a transient storage error, never
    blocks the user-facing delete."""
    document = await get_document(db, document_id, user_id)
    storage = get_storage_backend()
    if document.storage_path:
        try:
            storage.delete(document.storage_path)
        except Exception:
            logger.warning(
                "document_delete_storage_object_failed", document_id=document.id, exc_info=True
            )
    await repository.delete_document(db, document)
    await db.commit()


def _current_embedding_model() -> str:
    settings = get_settings()
    return f"{settings.embedding_provider}:{settings.embedding_model}"


async def get_reindex_status(db: AsyncSession, topic_id: int, user_id: int) -> dict:
    """How many of this topic's chunks were embedded with a provider/model
    other than the one currently configured -- e.g. after switching
    `EMBEDDING_PROVIDER`. A non-zero count means retrieval quality for
    those chunks reflects the old model, not necessarily the new one."""
    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    current_model = _current_embedding_model()
    stale_count = await repository.count_stale_chunks(db, topic_id, current_model)
    return {"currentEmbeddingModel": current_model, "staleChunkCount": stale_count}


async def reindex_topic(db: AsyncSession, topic_id: int, user_id: int) -> dict:
    """Re-chunks and re-embeds every note and completed document in a
    topic with the currently configured embedding provider/model. Each
    note/document re-index is independently idempotent (delete-then-insert
    chunks), so a failure partway through just leaves the remaining items
    stale rather than corrupting anything already redone."""
    from ..notes import repository as notes_repository

    await topics_service.get_owned_topic_or_404(db, topic_id, user_id)
    notes = await notes_repository.list_by_topic(db, topic_id, user_id)
    documents = await repository.list_documents_by_topic(db, topic_id)
    completed_documents = [document for document in documents if document.status == "completed"]

    for note in notes:
        await indexing.enqueue_note_index(note.id)
    for document in completed_documents:
        await indexing.enqueue_document_index(document.id)

    return {"notesQueued": len(notes), "documentsQueued": len(completed_documents)}
