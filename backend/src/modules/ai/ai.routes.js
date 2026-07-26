import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { validate } from "../../middleware/validate.js";
import {
  chatWithTutor,
  clearMessageHistory,
  getMessageHistory,
} from "./ai.controller.js";
import {
  chatSchema,
  clearMessageHistorySchema,
  messageHistorySchema,
} from "./ai.schema.js";
import { aiRateLimiter } from "../../middleware/rate-limit.js";

export const aiRoutes = Router();

aiRoutes.use(requireAuth);

aiRoutes.post(
  "/topics/:topicId/ai/chat",
  aiRateLimiter,
  validate(chatSchema),
  chatWithTutor,
);
aiRoutes.get(
  "/topics/:topicId/ai/messages",
  validate(messageHistorySchema),
  getMessageHistory,
);
aiRoutes.delete(
  "/topics/:topicId/ai/messages",
  validate(clearMessageHistorySchema),
  clearMessageHistory,
);
