import cors from "cors";
import express from "express";
import helmet from "helmet";
import { requestLogger } from "./config/logger.js";
import { sessionMiddleware } from "./config/session.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { aiRoutes } from "./modules/ai/ai.routes.js";
import { noteRoutes } from "./modules/notes/note.routes.js";
import { studyHistoryRoutes } from "./modules/study-history/study-history.routes.js";
import { topicRoutes } from "./modules/topics/topic.routes.js";
import { env } from "./config/env.js";
import { apiRateLimiter } from "./middleware/rate-limit.js";
import { pool } from "./db/pool.js";

export const app = express();

if (env.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  }),
);
app.use(requestLogger);
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  strictTransportSecurity: env.nodeEnv === "production"
    ? undefined
    : false,
}));
app.use(express.json({ limit: "100kb" }));
// -----------------------------------
app.use(sessionMiddleware);
// -----------------------------------
app.use("/api/v1", apiRateLimiter);
// -----------------------------------
app.use("/api/v1/auth", authRoutes);
// -----------------------------------
app.use("/api/v1/topics", topicRoutes);
// -----------------------------------
app.use("/api/v1", noteRoutes);
// -----------------------------------
app.use("/api/v1", aiRoutes);
// -----------------------------------
app.use("/api/v1/study-history", studyHistoryRoutes);
// -----------------------------------

app.get("/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ status: "ok" });
});

app.get("/health/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ status: "ready" });
  } catch (error) {
    req.log?.error({ err: error }, "Readiness check failed");
    res.status(503).json({
      status: "unavailable",
      requestId: req.id,
    });
  }
});

app.use(notFound);
app.use(errorHandler);
