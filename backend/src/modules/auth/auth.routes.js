import { Router } from "express";
import {
  login,
  logout,
  me,
  register,
  updateProfile,
} from "./auth.controller.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { validate } from "../../middleware/validate.js";
import {
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "./auth.schema.js";
import { authRateLimiter } from "../../middleware/rate-limit.js";

export const authRoutes = Router();

authRoutes.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  register,
);
authRoutes.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  login,
);
authRoutes.post("/logout", logout);
authRoutes.get("/me", me);
authRoutes.patch(
  "/me",
  requireAuth,
  validate(updateProfileSchema),
  updateProfile,
);
