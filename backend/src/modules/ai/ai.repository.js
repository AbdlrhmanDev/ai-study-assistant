import { pool } from "../../db/pool.js";

export async function findRecentMessagesByTopicIdForUser(
  topicId,
  userId,
  limit,
) {
  const result = await pool.query(
    `SELECT recent.id, recent.topic_id, recent.role, recent.message, recent.created_at
     FROM (
       SELECT cm.id, cm.topic_id, cm.role, cm.message, cm.created_at
       FROM chat_messages cm
       INNER JOIN topics t ON t.id = cm.topic_id
       WHERE cm.topic_id = $1 AND t.user_id = $2
       ORDER BY cm.created_at DESC, cm.id DESC
       LIMIT $3
     ) AS recent
     ORDER BY recent.created_at ASC, recent.id ASC`,
    [topicId, userId, limit],
  );

  return result.rows;
}

export async function createExchange(topicId, userMessage, assistantMessage) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO chat_messages (topic_id, role, message)
       VALUES ($1, 'user', $2)
       RETURNING id, topic_id, role, message, created_at`,
      [topicId, userMessage],
    );

    const assistantResult = await client.query(
      `INSERT INTO chat_messages (topic_id, role, message)
       VALUES ($1, 'assistant', $2)
       RETURNING id, topic_id, role, message, created_at`,
      [topicId, assistantMessage],
    );

    await client.query("COMMIT");

    return {
      userMessage: userResult.rows[0],
      assistantMessage: assistantResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteMessagesByTopicIdForUser(topicId, userId) {
  const result = await pool.query(
    `DELETE FROM chat_messages cm
     USING topics t
     WHERE cm.topic_id = $1
       AND cm.topic_id = t.id
       AND t.user_id = $2`,
    [topicId, userId],
  );

  return result.rowCount;
}
