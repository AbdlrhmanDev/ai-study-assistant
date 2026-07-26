import { asyncHandler } from "../../utils/async-handler.js";
import * as aiService from "./ai.service.js";

export const chatWithTutor = asyncHandler(async (req, res) => {
  const result = await aiService.chatWithTutor(
    req.session.user.id,
    req.validated.params.topicId,
    req.validated.body.question,
  );

  res.status(201).json(result);
});

export const getMessageHistory = asyncHandler(async (req, res) => {
  const messages = await aiService.getMessageHistory(
    req.session.user.id,
    req.validated.params.topicId,
    req.validated.query.limit,
  );

  res.json({ messages });
});

export const clearMessageHistory = asyncHandler(async (req, res) => {
  const deletedCount = await aiService.clearMessageHistory(
    req.session.user.id,
    req.validated.params.topicId,
  );

  res.json({ deletedCount });
});
