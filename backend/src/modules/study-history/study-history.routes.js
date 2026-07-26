import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getStudyStats,
  listStudyHistory,
} from "./study-history.controller.js";
import { studyHistoryQuerySchema } from "./study-history.schema.js";

export const studyHistoryRoutes = Router();

studyHistoryRoutes.use(requireAuth);
studyHistoryRoutes.get("/", validate(studyHistoryQuerySchema), listStudyHistory);
studyHistoryRoutes.get("/stats", getStudyStats);
