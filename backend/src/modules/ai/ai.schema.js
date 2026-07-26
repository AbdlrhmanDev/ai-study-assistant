import { z } from "zod";

const topicIdParams = z.object({
  topicId: z.coerce.number().int().positive(),
});

export const chatSchema = z.object({
  params: topicIdParams,
  body: z.object({
    question: z
      .string()
      .trim()
      .min(1, "Question is required")
      .max(2000, "Question must not exceed 2000 characters"),
  }),
});

export const messageHistorySchema = z.object({
  params: topicIdParams,
  query: z.object({
    limit: z.coerce.number().int().positive().max(50).default(20),
  }),
});

export const clearMessageHistorySchema = z.object({
  params: topicIdParams,
});
