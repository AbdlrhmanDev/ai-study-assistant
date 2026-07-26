import { pool } from "../../db/pool.js";

export async function createActivity({
  userId,
  topicId,
  activityType,
  description,
}) {
  const result = await pool.query(
    `INSERT INTO study_activities (
       user_id, topic_id, activity_type, description
     )
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, topic_id, activity_type, description, created_at`,
    [userId, topicId ?? null, activityType, description],
  );

  return result.rows[0];
}

function buildFilters(userId, type, topicId) {
  const values = [userId];
  const conditions = ["sa.user_id = $1"];

  if (type) {
    values.push(type);
    conditions.push(`sa.activity_type = $${values.length}`);
  }

  if (topicId) {
    values.push(topicId);
    conditions.push(`sa.topic_id = $${values.length}`);
  }

  return { values, where: conditions.join(" AND ") };
}

export async function findActivitiesByUserId({
  userId,
  type,
  topicId,
  limit,
  offset,
}) {
  const filters = buildFilters(userId, type, topicId);
  const limitIndex = filters.values.push(limit);
  const offsetIndex = filters.values.push(offset);
  const result = await pool.query(
    `SELECT
       sa.id,
       sa.topic_id,
       t.title AS topic_title,
       sa.activity_type,
       sa.description,
       sa.created_at
     FROM study_activities sa
     LEFT JOIN topics t ON t.id = sa.topic_id
     WHERE ${filters.where}
     ORDER BY sa.created_at DESC, sa.id DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    filters.values,
  );

  return result.rows;
}

export async function countActivitiesByUserId({ userId, type, topicId }) {
  const filters = buildFilters(userId, type, topicId);
  const result = await pool.query(
    `SELECT COUNT(*)::integer AS count
     FROM study_activities sa
     WHERE ${filters.where}`,
    filters.values,
  );

  return result.rows[0].count;
}

export async function getStatsByUserId(userId) {
  const result = await pool.query(
    `SELECT
       COUNT(*)::integer AS total_activities,
       COUNT(*) FILTER (
         WHERE created_at >= DATE_TRUNC('week', CURRENT_TIMESTAMP)
       )::integer AS activities_this_week,
       COUNT(*) FILTER (
         WHERE activity_type = 'ai_chat'
       )::integer AS ai_interactions,
       COUNT(DISTINCT topic_id)::integer AS topics_studied
     FROM study_activities
     WHERE user_id = $1`,
    [userId],
  );

  return result.rows[0];
}
