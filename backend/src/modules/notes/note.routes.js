import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createNote,
  deleteNote,
  getNote,
  getNotesByTopic,
  getPaginatedNotesByTopic,
  moveNoteToTopic,
  searchNotesByTopic,
  updateNote,
} from "./note.controller.js";
import {
  createNoteSchema,
  moveNoteSchema,
  noteIdSchema,
  searchNotesSchema,
  topicIdSchema,
  topicNotesPaginationSchema,
  updateNoteSchema,
} from "./note.schema.js";

export const noteRoutes = Router();

noteRoutes.use(requireAuth);

noteRoutes.get(
  "/topics/:topicId/notes/paginated",
  validate(topicNotesPaginationSchema),
  getPaginatedNotesByTopic,
);
noteRoutes.get(
  "/topics/:topicId/notes/search",
  validate(searchNotesSchema),
  searchNotesByTopic,
);
noteRoutes.get(
  "/topics/:topicId/notes",
  validate(topicIdSchema),
  getNotesByTopic,
);
noteRoutes.post(
  "/topics/:topicId/notes",
  validate(createNoteSchema),
  createNote,
);

noteRoutes.patch(
  "/notes/:id/move",
  validate(moveNoteSchema),
  moveNoteToTopic,
);
noteRoutes.get("/notes/:id", validate(noteIdSchema), getNote);
noteRoutes.patch("/notes/:id", validate(updateNoteSchema), updateNote);
noteRoutes.delete("/notes/:id", validate(noteIdSchema), deleteNote);
