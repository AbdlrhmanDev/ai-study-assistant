import { AppError } from "../../utils/app-error.js";
import * as topicRepository from "./topic.repository.js";
import { recordActivitySafely } from "../study-history/study-history.service.js";

// جلب مواضيع المستخدم
export function getAllTopics(userId) {
  return topicRepository.findManyByUserId(userId);
}

// إنشاء موضوع
export async function createTopic(userId, payload) {
  const topic = await topicRepository.create({
    userId,
    title: payload.title,
    description: payload.description ?? null,
  });

  await recordActivitySafely({
    userId,
    topicId: topic.id,
    activityType: "topic_created",
    description: `Created topic: ${topic.title}`,
  });

  return topic;
}

// جلب موضوع واحد
export async function getTopic(userId, topicId) {
  const topic = await topicRepository.findByIdForUser(
      topicId,
      userId,
  );

  if (!topic) {
    throw new AppError("Topic not found", 404);
  }

  await recordActivitySafely({
    userId,
    topicId: topic.id,
    activityType: "topic_updated",
    description: `Updated topic: ${topic.title}`,
  });

  return topic;
}

// تعديل موضوع
export async function updateTopic({
                                    topicId,
                                    userId,
                                    title,
                                    description,
                                  }) {
  const topic = await topicRepository.update({
    topicId,
    userId,
    title,
    description,
  });

  if (!topic) {
    throw new AppError("Topic not found", 404);
  }

  return topic;
}

// حذف موضوع
export async function deleteTopic(userId, topicId) {
  const topic = await topicRepository.remove(userId, topicId);

  if (!topic) {
    throw new AppError("Topic not found", 404);
  }

  return topic;
}
