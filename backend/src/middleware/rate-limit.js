import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

function rateLimitHandler(req, res) {
  res.status(429).json({
    message: "Too many requests, please try again later",
    requestId: req.id,
  });
}

const commonOptions = {
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rateLimitHandler,
};

export const apiRateLimiter = rateLimit({
  ...commonOptions,
  identifier: "api",
  windowMs: 15 * 60 * 1000,
  limit: env.apiRateLimit,
});

export const authRateLimiter = rateLimit({
  ...commonOptions,
  identifier: "authentication",
  windowMs: 15 * 60 * 1000,
  limit: env.authRateLimit,
  skipSuccessfulRequests: true,
});

export const aiRateLimiter = rateLimit({
  ...commonOptions,
  identifier: "ai",
  windowMs: 60 * 60 * 1000,
  limit: env.aiRateLimit,
  keyGenerator(req) {
    return req.session?.user?.id
      ? `user:${req.session.user.id}`
      : ipKeyGenerator(req.ip);
  },
});
