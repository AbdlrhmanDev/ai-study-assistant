import assert from "node:assert/strict";
import test from "node:test";
import {
  searchNotesSchema,
  updateNoteSchema,
} from "../src/modules/notes/note.schema.js";
import { updateTopicSchema } from "../src/modules/topics/topic.schema.js";
import { updateProfileSchema } from "../src/modules/auth/auth.schema.js";
import {
  chatSchema,
  messageHistorySchema,
} from "../src/modules/ai/ai.schema.js";
import { studyHistoryQuerySchema } from "../src/modules/study-history/study-history.schema.js";

test("partial update schemas reject empty bodies", () => {
  assert.equal(
    updateNoteSchema.safeParse({
      params: { id: "1" },
      body: {},
    }).success,
    false,
  );
  assert.equal(
    updateTopicSchema.safeParse({
      params: { id: "1" },
      body: {},
    }).success,
    false,
  );
  assert.equal(
    updateProfileSchema.safeParse({ body: {} }).success,
    false,
  );
});

test("note search schema coerces pagination defaults", () => {
  const result = searchNotesSchema.safeParse({
    params: { topicId: "2" },
    query: { search: "javascript" },
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data.query, {
    search: "javascript",
    page: 1,
    limit: 10,
  });
});

test("note search schema rejects invalid pagination", () => {
  const result = searchNotesSchema.safeParse({
    params: { topicId: "2" },
    query: {
      search: "javascript",
      page: "0",
      limit: "101",
    },
  });

  assert.equal(result.success, false);
});

test("AI chat schema trims and accepts a valid question", () => {
  const result = chatSchema.safeParse({
    params: { topicId: "3" },
    body: { question: "  Explain this topic  " },
  });

  assert.equal(result.success, true);
  assert.equal(result.data.params.topicId, 3);
  assert.equal(result.data.body.question, "Explain this topic");
});

test("AI chat schema rejects empty and oversized questions", () => {
  assert.equal(
    chatSchema.safeParse({
      params: { topicId: "3" },
      body: { question: "   " },
    }).success,
    false,
  );
  assert.equal(
    chatSchema.safeParse({
      params: { topicId: "3" },
      body: { question: "a".repeat(2001) },
    }).success,
    false,
  );
});

test("AI history schema supplies a limit and rejects excessive limits", () => {
  const validResult = messageHistorySchema.safeParse({
    params: { topicId: "3" },
    query: {},
  });
  const invalidResult = messageHistorySchema.safeParse({
    params: { topicId: "3" },
    query: { limit: "51" },
  });

  assert.equal(validResult.success, true);
  assert.equal(validResult.data.query.limit, 20);
  assert.equal(invalidResult.success, false);
});

test("study history schema supplies pagination defaults and validates filters", () => {
  const validResult = studyHistoryQuerySchema.safeParse({
    query: { type: "ai_chat", topicId: "4" },
  });
  const invalidResult = studyHistoryQuerySchema.safeParse({
    query: { type: "unknown_activity" },
  });

  assert.equal(validResult.success, true);
  assert.deepEqual(validResult.data.query, {
    page: 1,
    limit: 20,
    type: "ai_chat",
    topicId: 4,
  });
  assert.equal(invalidResult.success, false);
});
