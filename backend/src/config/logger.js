import { randomUUID } from "node:crypto";
import pino from "pino";
import pinoHttp from "pino-http";
import { env } from "./env.js";

export const logger = pino({
  level: env.logLevel,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "password",
      "password_hash",
    ],
    censor: "[REDACTED]",
  },
});

export const requestLogger = pinoHttp({
  logger,
  genReqId(req, res) {
    const incomingId = req.headers["x-request-id"];
    const requestId = typeof incomingId === "string"
      ? incomingId.slice(0, 100)
      : randomUUID();

    res.setHeader("X-Request-Id", requestId);
    return requestId;
  },
  customLogLevel(_req, res, error) {
    if (error || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});
