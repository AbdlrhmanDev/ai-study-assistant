import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      email: z.string().trim().email().max(255).optional(),
    })
    .refine(
      (body) => body.name !== undefined || body.email !== undefined,
      { message: "At least one field is required" },
    ),
});
