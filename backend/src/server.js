import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { logger } from "./config/logger.js";

async function startServer() {
  try {
    await pool.query("select 1");

    const server = app.listen(env.port, () => {
      logger.info(
        { port: env.port, environment: env.nodeEnv },
        "API server started",
      );
    });
    server.requestTimeout = 30000;
    server.headersTimeout = 15000;
    server.keepAliveTimeout = 5000;

    async function shutdown(signal) {
      logger.info({ signal }, "Shutting down");
      server.close(async () => {
        await pool.end();
        logger.info("Shutdown complete");
        process.exit(0);
      });

      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10000).unref();
    }

    process.once("SIGTERM", () => void shutdown("SIGTERM"));
    process.once("SIGINT", () => void shutdown("SIGINT"));
  } catch (error) {
    logger.fatal({ err: error }, "Could not connect to PostgreSQL");
    process.exit(1);
  }
}

startServer();
