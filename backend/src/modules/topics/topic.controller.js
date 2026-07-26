import { asyncHandler } from "../../utils/async-handler.js";
import * as topicService from "./topic.service.js";

export const getAllTopics = asyncHandler(async (req, res) => {
  const topics = await topicService.getAllTopics(req.session.user.id);
  res.json({ topics });
});

export const createTopic = asyncHandler(async (req, res) => {
  const topic = await topicService.createTopic(req.session.user.id, req.validated.body);
  res.status(201).json({ topic });
});

export const getTopic = asyncHandler(async (req, res) => {
  const topic = await topicService.getTopic(req.session.user.id, req.validated.params.id);
  res.json({ topic });
});


export const updateTopic = asyncHandler(async (req, res) => {
  const topic = await topicService.updateTopic({
    userId: req.session.user.id,
    topicId: req.validated.params.id,
    ...req.validated.body,
  });

  res.json({ topic });
});

export const deleteTopic = asyncHandler(async (req, res) => {
  await topicService.deleteTopic(
    req.session.user.id,
    req.validated.params.id,
  );

  res.status(204).send();
});
