import { z } from "zod";

export const createTopicSchema = z.object({
  body: z.object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(200, "Title must not exceed 200 characters"),
    description: z
      .string()
      .trim()
      .max(1000, "Description is too long")
      .nullable()
      .optional(),
  }),
});

export const topicIdSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});


export const updateTopicSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z
      .object({
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().trim().max(1000).nullable().optional(),
      })
      .refine(
          (body) => body.title !== undefined || body.description !== undefined,
          { message: "At least one field is required" },
      ),
});
