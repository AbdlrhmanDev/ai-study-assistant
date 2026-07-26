import { AppError } from "../../utils/app-error.js";
import * as noteRepository from "../notes/note.repository.js";
import * as topicRepository from "../topics/topic.repository.js";
import { buildTutorInput, tutorInstructions } from "./ai.prompt.js";
import { generateTutorAnswer } from "./ai.provider.js";
import * as aiRepository from "./ai.repository.js";
import { recordActivitySafely } from "../study-history/study-history.service.js";

const MAX_CONTEXT_NOTES = 20;
const MAX_NOTE_CHARACTERS = 30000;
const MODEL_HISTORY_LIMIT = 10;

async function requireTopic(userId, topicId) {
  const topic = await topicRepository.findByIdForUser(topicId, userId);

  if (!topic) {
    throw new AppError("Topic not found", 404);
  }

  return topic;
}

function selectNoteContext(notes) {
  let usedCharacters = 0;
  const selected = [];

  for (const note of notes.slice(0, MAX_CONTEXT_NOTES)) {
    const remaining = MAX_NOTE_CHARACTERS - usedCharacters;

    if (remaining <= 0) {
      break;
    }

    const content = note.content.slice(0, remaining);
    selected.push({ ...note, content });
    usedCharacters += content.length;
  }

  return selected;
}

export async function chatWithTutor(userId, topicId, question) {
  const topic = await requireTopic(userId, topicId);
  const [notes, history] = await Promise.all([
    noteRepository.findManyByTopicIdForUser(topicId, userId),
    aiRepository.findRecentMessagesByTopicIdForUser(
      topicId,
      userId,
      MODEL_HISTORY_LIMIT,
    ),
  ]);

  let generated;

  try {
    generated = await generateTutorAnswer(
      tutorInstructions,
      buildTutorInput({
        topic,
        notes: selectNoteContext(notes),
        history,
        question,
      }),
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("AI tutor is temporarily unavailable", 502, {
      cause: error.message,
    });
  }

  const answer = generated.text?.trim();

  if (!answer) {
    throw new AppError("AI tutor returned an empty response", 502);
  }

  const messages = await aiRepository.createExchange(
    topicId,
    question,
    answer,
  );

  await recordActivitySafely({
    userId,
    topicId,
    activityType: "ai_chat",
    description: `Asked AI tutor about: ${topic.title}`,
  });

  return {
    answer,
    provider: generated.provider,
    model: generated.model,
    messages,
  };
}

export async function getMessageHistory(userId, topicId, limit) {
  await requireTopic(userId, topicId);

  return aiRepository.findRecentMessagesByTopicIdForUser(
    topicId,
    userId,
    limit,
  );
}

export async function clearMessageHistory(userId, topicId) {
  await requireTopic(userId, topicId);

  return aiRepository.deleteMessagesByTopicIdForUser(topicId, userId);
}
