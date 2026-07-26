import { asyncHandler } from "../../utils/async-handler.js";
import * as noteService from "./note.service.js";

export const getNotesByTopic = asyncHandler(async (req, res) => {
  const notes = await noteService.getNotesByTopic(
    req.session.user.id,
    req.validated.params.topicId,
  );

  res.json({ notes });
});

export const getNote = asyncHandler(async (req, res) => {
  const note = await noteService.getNote(
    req.session.user.id,
    req.validated.params.id,
  );

  res.json({ note });
});

export const createNote = asyncHandler(async (req, res) => {
  const note = await noteService.createNote(
    req.session.user.id,
    req.validated.params.topicId,
    req.validated.body,
  );

  res.status(201).json({ note });
});

export const updateNote = asyncHandler(async (req, res) => {
  const note = await noteService.updateNote({
    userId: req.session.user.id,
    noteId: req.validated.params.id,
    ...req.validated.body,
  });

  res.json({ note });
});

export const deleteNote = asyncHandler(async (req, res) => {
  await noteService.deleteNote(
    req.session.user.id,
    req.validated.params.id,
  );

  res.status(204).send();
});

export const getPaginatedNotesByTopic = asyncHandler(
  async (req, res) => {
    const result = await noteService.getPaginatedNotesByTopic(
      req.session.user.id,
      req.validated.params.topicId,
      req.validated.query.page,
      req.validated.query.limit,
    );

    res.json(result);
  },
);

export const searchNotesByTopic = asyncHandler(async (req, res) => {
  const result = await noteService.searchNotesByTopic(
    req.session.user.id,
    req.validated.params.topicId,
    req.validated.query.search,
    req.validated.query.page,
    req.validated.query.limit,
  );

  res.json(result);
});

export const moveNoteToTopic = asyncHandler(async (req, res) => {
  const note = await noteService.moveNoteToTopic(
    req.session.user.id,
    req.validated.params.id,
    req.validated.body.targetTopicId,
  );

  res.json({ note });
});
