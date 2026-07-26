import { env } from "../config/env.js";

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const isInternalError = statusCode >= 500;

  if (isInternalError) {
    req.log?.error({ err, requestId: req.id }, "Request failed");
  }

  res.status(statusCode).json({
    message: isInternalError
      ? "Internal server error"
      : err.message || "Request failed",
    details: isInternalError ? undefined : err.details,
    stack: env.nodeEnv === "production" ? undefined : err.stack,
    requestId: req.id,
  });
}
