import pg from "pg";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: env.databasePoolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: env.databaseSsl
    ? { rejectUnauthorized: false }
    : undefined,
});

pool.on("error", (error) => {
  logger.error({ err: error }, "Unexpected PostgreSQL pool error");
});
