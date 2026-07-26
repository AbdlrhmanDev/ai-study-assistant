import { Router } from "express";
import {
  createTopic,
  deleteTopic,
  getTopic,
  getAllTopics,
  updateTopic,
} from "./topic.controller.js";

import { requireAuth } from "../../middleware/require-auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createTopicSchema,
  topicIdSchema,
  updateTopicSchema,
} from "./topic.schema.js";

export const topicRoutes = Router();

topicRoutes.use(requireAuth);

topicRoutes.get("/", getAllTopics);
topicRoutes.post("/", validate(createTopicSchema), createTopic);
topicRoutes.get("/:id", validate(topicIdSchema), getTopic);
topicRoutes.patch("/:id", validate(updateTopicSchema), updateTopic);
topicRoutes.delete("/:id", validate(topicIdSchema), deleteTopic);
