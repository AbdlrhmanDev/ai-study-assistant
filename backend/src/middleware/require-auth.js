import { AppError } from "../utils/app-error.js";

export function requireAuth(req, _res, next) {
  if (!req.session?.user) {
    return next(new AppError("Authentication required", 401));
  }

  return next();
}
