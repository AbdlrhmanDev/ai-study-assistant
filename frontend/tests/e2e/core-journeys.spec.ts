import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

test.beforeEach(async ({ page }) => mockApi(page));

test("registration and login forms expose the required account journey", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByLabel("Full name")).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveAttribute("type", "email");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("minlength", "8");
  await expect(page.getByRole("button", { name: "Create my account" })).toBeVisible();

  await page.goto("/login");
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to Studia" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register");
});

test("core learning routes render with API-backed states", async ({ page }) => {
  for (const [path, heading] of [
    ["/topics", "My topics"],
    ["/ai-tutor", "AI tutor"],
    ["/quizzes", "Quizzes"],
    ["/flashcards", "Flashcards"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
});

test("topic documents can be selected for upload", async ({ page }) => {
  await page.goto("/topic?topicId=1");
  await expect(page.getByRole("heading", { name: "Study documents", exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "lesson.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Study material"),
  });
  expect(await page.locator('input[type="file"]').evaluate((input: HTMLInputElement) => input.files?.length)).toBe(1);
});

test("dense learning pages remain navigable on mobile", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile viewport coverage");

  for (const [path, heading] of [
    ["/exams", "Exams"],
    ["/workspace", "Workspace"],
    ["/flashcards", "Flashcards"],
    ["/mind-map?topicId=1", "Mind map"],
    ["/knowledge-graph?topicId=1", "Knowledge Graph"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    // Mobile navigation is the bottom "Quick navigation" tab bar + "More"
    // sheet (see responsive-layout.spec.ts), not the desktop hamburger
    // trigger -- that's hidden on mobile across the whole dashboard shell.
    await expect(page.getByRole("navigation", { name: "Quick navigation" })).toBeVisible();
    await expect(page.locator('aside[aria-label="Primary navigation"]')).toBeAttached();
  }
});
