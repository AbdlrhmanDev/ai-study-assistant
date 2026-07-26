import { pool } from "../../db/pool.js";

export async function findManyByTopicIdForUser(topicId, userId) {
  const result = await pool.query(
    `SELECT n.id, n.topic_id, n.title, n.content, n.created_at, n.updated_at
     FROM notes n
     INNER JOIN topics t ON t.id = n.topic_id
     WHERE n.topic_id = $1 AND t.user_id = $2
     ORDER BY n.updated_at DESC, n.id DESC`,
    [topicId, userId],
  );

  return result.rows;
}

export async function findByIdForUser(noteId, userId) {
  const result = await pool.query(
    `SELECT n.id, n.topic_id, n.title, n.content, n.created_at, n.updated_at
     FROM notes n
     INNER JOIN topics t ON t.id = n.topic_id
     WHERE n.id = $1 AND t.user_id = $2`,
    [noteId, userId],
  );

  return result.rows[0] ?? null;
}

export async function create(note) {
  const result = await pool.query(
    `INSERT INTO notes (topic_id, title, content)
     SELECT t.id, $3, $4
     FROM topics t
     WHERE t.id = $1 AND t.user_id = $2
     RETURNING id, topic_id, title, content, created_at, updated_at`,
    [note.topicId, note.userId, note.title, note.content],
  );

  return result.rows[0] ?? null;
}

export async function update({
  noteId,
  userId,
  title,
  content,
}) {
  const result = await pool.query(
    `UPDATE notes n
     SET title = COALESCE($1, n.title),
         content = COALESCE($2, n.content),
         updated_at = CURRENT_TIMESTAMP
     FROM topics t
     WHERE n.id = $3
       AND n.topic_id = t.id
       AND t.user_id = $4
     RETURNING n.id, n.topic_id, n.title, n.content, n.created_at, n.updated_at`,
    [title ?? null, content ?? null, noteId, userId],
  );

  return result.rows[0] ?? null;
}

export async function remove(noteId, userId) {
  const result = await pool.query(
    `DELETE FROM notes n
     USING topics t
     WHERE n.id = $1
       AND n.topic_id = t.id
       AND t.user_id = $2
     RETURNING n.id, n.topic_id, n.title, n.content, n.created_at, n.updated_at`,
    [noteId, userId],
  );

  return result.rows[0] ?? null;
}

export async function countByTopicIdForUser(topicId, userId) {
  const result = await pool.query(
    `SELECT COUNT(*)::integer AS count
     FROM notes n
     INNER JOIN topics t ON t.id = n.topic_id
     WHERE n.topic_id = $1 AND t.user_id = $2`,
    [topicId, userId],
  );

  return result.rows[0].count;
}

export async function searchByTopicIdForUser(
  topicId,
  userId,
  searchTerm,
  limit,
  offset,
) {
  const result = await pool.query(
    `SELECT n.id, n.topic_id, n.title, n.content, n.created_at, n.updated_at
     FROM notes n
     INNER JOIN topics t ON t.id = n.topic_id
     WHERE n.topic_id = $1
       AND t.user_id = $2
       AND (n.title ILIKE $3 OR n.content ILIKE $3)
     ORDER BY n.updated_at DESC, n.id DESC
     LIMIT $4 OFFSET $5`,
    [topicId, userId, `%${searchTerm}%`, limit, offset],
  );

  return result.rows;
}

export async function countSearchByTopicIdForUser(
  topicId,
  userId,
  searchTerm,
) {
  const result = await pool.query(
    `SELECT COUNT(*)::integer AS count
     FROM notes n
     INNER JOIN topics t ON t.id = n.topic_id
     WHERE n.topic_id = $1
       AND t.user_id = $2
       AND (n.title ILIKE $3 OR n.content ILIKE $3)`,
    [topicId, userId, `%${searchTerm}%`],
  );

  return result.rows[0].count;
}

export async function findManyPaginatedByTopicIdForUser(
  topicId,
  userId,
  limit,
  offset,
) {
  const result = await pool.query(
    `SELECT n.id, n.topic_id, n.title, n.content, n.created_at, n.updated_at
     FROM notes n
     INNER JOIN topics t ON t.id = n.topic_id
     WHERE n.topic_id = $1 AND t.user_id = $2
     ORDER BY n.updated_at DESC, n.id DESC
     LIMIT $3 OFFSET $4`,
    [topicId, userId, limit, offset],
  );

  return result.rows;
}

export async function moveToTopic(
  noteId,
  targetTopicId,
  userId,
) {
  const result = await pool.query(
    `UPDATE notes n
     SET topic_id = target_topic.id,
         updated_at = CURRENT_TIMESTAMP
     FROM topics current_topic, topics target_topic
     WHERE n.id = $1
       AND n.topic_id = current_topic.id
       AND current_topic.user_id = $2
       AND target_topic.id = $3
       AND target_topic.user_id = $2
     RETURNING n.id, n.topic_id, n.title, n.content, n.created_at, n.updated_at`,
    [noteId, userId, targetTopicId],
  );

  return result.rows[0] ?? null;
}
