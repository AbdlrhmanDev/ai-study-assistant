import { asyncHandler } from "../../utils/async-handler.js";
import * as studyHistoryService from "./study-history.service.js";

export const listStudyHistory = asyncHandler(async (req, res) => {
  const result = await studyHistoryService.getStudyHistory(
    req.session.user.id,
    req.validated.query,
  );

  res.json(result);
});

export const getStudyStats = asyncHandler(async (req, res) => {
  const stats = await studyHistoryService.getStudyStats(
    req.session.user.id,
  );

  res.json({ stats });
});
