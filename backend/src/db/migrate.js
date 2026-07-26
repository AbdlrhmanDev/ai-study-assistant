import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const INITIAL_MIGRATION = "001_initial_schema";
const STUDY_HISTORY_MIGRATION = "002_study_history";
const STUDY_HISTORY_BACKFILL = "003_backfill_study_history";

async function migrate() {
  let client;

  try {
    client = await pool.connect();
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
       )`,
    );

    const appliedMigration = await client.query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      [INITIAL_MIGRATION],
    );

    if (appliedMigration.rowCount > 0) {
      await applyStudyHistoryMigrations(client);
      console.log("Database schema is up to date");
      return;
    }

    const existingTables = await client.query(
      `SELECT
         to_regclass('public.users') IS NOT NULL AS users,
         to_regclass('public.topics') IS NOT NULL AS topics,
         to_regclass('public.notes') IS NOT NULL AS notes,
         to_regclass('public.chat_messages') IS NOT NULL AS chat_messages`,
    );
    const tables = existingTables.rows[0];
    const allCoreTablesExist = (
      tables.users
      && tables.topics
      && tables.notes
      && tables.chat_messages
    );
    const anyCoreTableExists = (
      tables.users
      || tables.topics
      || tables.notes
      || tables.chat_messages
    );

    if (allCoreTablesExist) {
      await recordMigration(client);
      await applyStudyHistoryMigrations(client);
      console.log("Existing database schema registered successfully");
      return;
    }

    if (anyCoreTableExists) {
      throw new Error(
        "Database schema is incomplete; restore or remove the partial tables before migrating",
      );
    }

    const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));
    const schema = await readFile(schemaPath, "utf8");

    await client.query(schema);
    await recordMigration(client);
    await applyStudyHistoryMigrations(client);
    console.log("Database schema applied successfully");
  } catch (error) {
    console.error("Database migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}

function recordMigration(client) {
  return client.query(
    "INSERT INTO schema_migrations (name) VALUES ($1)",
    [INITIAL_MIGRATION],
  );
}

async function applyStudyHistoryMigrations(client) {
  await applySqlMigration(
    client,
    STUDY_HISTORY_MIGRATION,
    "./migrations/002_study_history.sql",
  );
  await applySqlMigration(
    client,
    STUDY_HISTORY_BACKFILL,
    "./migrations/003_backfill_study_history.sql",
  );
}

async function applySqlMigration(client, name, relativePath) {
  const applied = await client.query(
    "SELECT 1 FROM schema_migrations WHERE name = $1",
    [name],
  );

  if (applied.rowCount > 0) {
    return;
  }

  const migrationPath = fileURLToPath(
    new URL(relativePath, import.meta.url),
  );
  const migration = await readFile(migrationPath, "utf8");

  await client.query("BEGIN");
  try {
    await client.query(migration);
    await client.query(
      "INSERT INTO schema_migrations (name) VALUES ($1)",
      [name],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

migrate();
