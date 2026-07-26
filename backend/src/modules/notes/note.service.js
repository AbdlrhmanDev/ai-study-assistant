import { AppError } from "../../utils/app-error.js";
import * as noteRepository from "./note.repository.js";
import * as topicRepository from "../topics/topic.repository.js";
import { recordActivitySafely } from "../study-history/study-history.service.js";

export async function getNotesByTopic(userId, topicId) {
  await ensureTopicExists(userId, topicId);
  return noteRepository.findManyByTopicIdForUser(topicId, userId);
}

export async function getNote(userId, noteId) {
  const note = await noteRepository.findByIdForUser(noteId, userId);

  if (!note) {
    throw new AppError("Note not found", 404);
  }

  return note;
}

export async function createNote(userId, topicId, payload) {
  const note = await noteRepository.create({
    userId,
    topicId,
    title: payload.title,
    content: payload.content,
  });

  if (!note) {
    throw new AppError("Topic not found", 404);
  }

  await recordActivitySafely({
    userId,
    topicId: note.topic_id,
    activityType: "note_created",
    description: `Created note: ${note.title}`,
  });

  return note;
}

export async function updateNote({
  userId,
  noteId,
  title,
  content,
}) {
  const note = await noteRepository.update({
    userId,
    noteId,
    title,
    content,
  });

  if (!note) {
    throw new AppError("Note not found", 404);
  }

  await recordActivitySafely({
    userId,
    topicId: note.topic_id,
    activityType: "note_updated",
    description: `Updated note: ${note.title}`,
  });

  return note;
}

export async function deleteNote(userId, noteId) {
  const note = await noteRepository.remove(noteId, userId);

  if (!note) {
    throw new AppError("Note not found", 404);
  }

  return note;
}

export async function getPaginatedNotesByTopic(
  userId,
  topicId,
  page,
  limit,
) {
  await ensureTopicExists(userId, topicId);
  const offset = (page - 1) * limit;

  const [notes, total] = await Promise.all([
    noteRepository.findManyPaginatedByTopicIdForUser(
      topicId,
      userId,
      limit,
      offset,
    ),
    noteRepository.countByTopicIdForUser(topicId, userId),
  ]);

  return {
    notes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function searchNotesByTopic(
  userId,
  topicId,
  searchTerm,
  page,
  limit,
) {
  await ensureTopicExists(userId, topicId);
  const offset = (page - 1) * limit;

  const [notes, total] = await Promise.all([
    noteRepository.searchByTopicIdForUser(
      topicId,
      userId,
      searchTerm,
      limit,
      offset,
    ),
    noteRepository.countSearchByTopicIdForUser(
      topicId,
      userId,
      searchTerm,
    ),
  ]);

  return {
    notes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function moveNoteToTopic(
  userId,
  noteId,
  targetTopicId,
) {
  const note = await noteRepository.moveToTopic(
    noteId,
    targetTopicId,
    userId,
  );

  if (!note) {
    throw new AppError("Note or target topic not found", 404);
  }

  await recordActivitySafely({
    userId,
    topicId: note.topic_id,
    activityType: "note_moved",
    description: `Moved note: ${note.title}`,
  });

  return note;
}

async function ensureTopicExists(userId, topicId) {
  const topic = await topicRepository.findByIdForUser(topicId, userId);

  if (!topic) {
    throw new AppError("Topic not found", 404);
  }
}
