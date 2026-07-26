import { z } from "zod";

export const createNoteSchema = z.object({
  params: z.object({
    topicId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(200, "Title must not exceed 200 characters"),
    content: z
      .string()
      .trim()
      .min(1, "Content is required"),
  }),
});

export const noteIdSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

export const topicIdSchema = z.object({
  params: z.object({
    topicId: z.coerce.number().int().positive(),
  }),
});

export const topicNotesPaginationSchema = z.object({
  params: z.object({
    topicId: z.coerce.number().int().positive(),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
  }),
});

export const searchNotesSchema = z.object({
  params: z.object({
    topicId: z.coerce.number().int().positive(),
  }),
  query: z.object({
    search: z.string().trim().min(1, "Search term is required"),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
  }),
});

export const moveNoteSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    targetTopicId: z.coerce.number().int().positive(),
  }),
});

export const updateNoteSchema = z.object({
    params: z.object({
        id: z.coerce.number().int().positive(),
    }),
    body: z
        .object({
            title: z
                .string()
                .trim()
                .min(1, "Title is required")
                .max(200, "Title must not exceed 200 characters")
                .optional(),
            content: z
                .string()
                .trim()
                .min(1, "Content is required")
                .optional(),
        })
        .refine(
            (body) =>
                body.title !== undefined || body.content !== undefined,
            {
                message: "At least one field is required",
            },
        ),
});
