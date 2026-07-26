import { pool } from "../../db/pool.js";

export async function findManyByUserId(userId) {
  const result = await pool.query(
    `select id, title, description, created_at, updated_at
     from topics
     where user_id = $1
     order by created_at desc`,
    [userId],
  );

  return result.rows;
}

export async function findByIdForUser(id, userId) {
  const result = await pool.query(
    `select id, title, description, created_at, updated_at
     from topics
     where id = $1 and user_id = $2`,
    [id, userId],
  );

  return result.rows[0] || null;
}

export async function create(topic) {
  const result = await pool.query(
    `insert into topics (user_id, title, description)
     values ($1, $2, $3)
     returning id, title, description, created_at, updated_at`,
    [topic.userId, topic.title, topic.description],
  );

  return result.rows[0];
}

export async function update({
                               topicId,
                               userId,
                               title,
                               description,
                             }) {
  const result = await pool.query(
      `UPDATE topics
       SET title = COALESCE($1, title),
           description = CASE
                           WHEN $2::boolean THEN $3
                           ELSE description
                         END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5
         RETURNING id, title, description, created_at, updated_at`,
      [
        title ?? null,
        description !== undefined,
        description ?? null,
        topicId,
        userId,
      ],
  );

  return result.rows[0] ?? null;
}

export async function remove(userId, topicId) {
  const result = await pool.query(
      `DELETE FROM topics
       WHERE id = $1 AND user_id = $2
         RETURNING id, user_id, title, description, created_at, updated_at`,
      [topicId, userId],
  );

  return result.rows[0] ?? null;
}
