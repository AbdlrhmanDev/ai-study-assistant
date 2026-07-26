import * as studyHistoryRepository from "./study-history.repository.js";

export async function recordActivity(activity) {
  return studyHistoryRepository.createActivity(activity);
}

export async function recordActivitySafely(activity) {
  try {
    return await recordActivity(activity);
  } catch (error) {
    console.error("Unable to record study activity:", error.message);
    return null;
  }
}

export async function getStudyHistory(
  userId,
  { page, limit, type, topicId },
) {
  const offset = (page - 1) * limit;
  const query = { userId, type, topicId };
  const [activities, total] = await Promise.all([
    studyHistoryRepository.findActivitiesByUserId({
      ...query,
      limit,
      offset,
    }),
    studyHistoryRepository.countActivitiesByUserId(query),
  ]);

  return {
    activities,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export function getStudyStats(userId) {
  return studyHistoryRepository.getStatsByUserId(userId);
}
