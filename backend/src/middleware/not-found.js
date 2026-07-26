import { AppError } from "../utils/app-error.js";

export function notFound(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}
