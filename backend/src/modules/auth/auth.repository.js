import { pool } from "../../db/pool.js";

export async function findByEmail(email) {
  const result = await pool.query(
    "select * from users where lower(email) = lower($1)",
    [email],
  );
  return result.rows[0] || null;
}

export async function create(user) {
  const result = await pool.query(
    `insert into users (name, email, password_hash)
     values ($1, $2, $3)
     returning id, name, email, password_hash`,
    [user.name, user.email, user.passwordHash],
  );

  return result.rows[0];
}

export async function updateProfile(userId, profile) {
  const result = await pool.query(
    `update users
     set name = coalesce($1, name),
         email = coalesce($2, email),
         updated_at = current_timestamp
     where id = $3
     returning id, name, email`,
    [profile.name ?? null, profile.email ?? null, userId],
  );

  return result.rows[0] ?? null;
}
