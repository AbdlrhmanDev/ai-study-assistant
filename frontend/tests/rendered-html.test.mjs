import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appRoot = new URL("../app/", import.meta.url);

async function source(path) {
  return readFile(new URL(path, appRoot), "utf8");
}

test("landing page presents the Studia product and primary journeys", async () => {
  const [page, layout] = await Promise.all([
    source("page.tsx"),
    source("layout.tsx"),
  ]);

  assert.match(layout, /Studia/);
  assert.match(layout, /AI Study Assistant/);
  assert.match(page, /Learn smarter/);
  assert.match(page, /Start learning for free/);
  assert.match(page, /href="\/login"/);
  assert.match(page, /href="\/register"/);
  assert.doesNotMatch(page, /Your site is taking shape|Building your site/);
});

test("authentication form submits real login and registration requests", async () => {
  const authForm = await source("components/AuthForm.tsx");

  assert.match(authForm, /mode: "login" \| "register"/);
  assert.match(authForm, /"\/auth\/login"/);
  assert.match(authForm, /"\/auth\/register"/);
  assert.match(authForm, /router\.replace\("\/dashboard"\)/);
});

test("authenticated shell exposes core study workflows", async () => {
  const [sidebar, topics, apiClient] = await Promise.all([
    source("components/AppSidebar.tsx"),
    source("components/pages/TopicsPage.tsx"),
    source("lib/api.ts"),
  ]);

  for (const route of ["/dashboard", "/topics", "/ai-tutor", "/quizzes", "/flashcards"]) {
    assert.match(sidebar, new RegExp(route.replace("/", "\\/")));
  }
  assert.match(topics, /\/topics/);
  assert.match(apiClient, /NEXT_PUBLIC_API_URL/);
  assert.match(apiClient, /credentials:\s*"include"/);
});
