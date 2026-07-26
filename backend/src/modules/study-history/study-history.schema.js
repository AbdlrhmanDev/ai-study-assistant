import { z } from "zod";

const activityTypes = [
  "topic_created",
  "topic_updated",
  "note_created",
  "note_updated",
  "note_moved",
  "ai_chat",
];

export const studyHistoryQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    type: z.enum(activityTypes).optional(),
    topicId: z.coerce.number().int().positive().optional(),
  }),
});
