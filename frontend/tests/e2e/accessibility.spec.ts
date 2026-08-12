import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

test.beforeEach(async ({ page }) => mockApi(page));

// wcag2a/wcag2aa/wcag21aa cover the acceptance bar this app targets; "best-practice"
// rules are excluded since they flag stylistic choices rather than real a11y defects.
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa"];

for (const [path, label] of [
  ["/register", "register"],
  ["/login", "login"],
  ["/topics", "topics"],
  ["/ai-tutor", "ai tutor"],
  ["/quizzes", "quizzes"],
  ["/flashcards", "flashcards"],
]) {
  test(`${label} page has no automatically detectable a11y violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

// The topics list only finishes fetching after React hydrates, so waiting for
// its loading state to clear is a reliable "page is interactive" signal --
// unlike the heading, which paints from SSR HTML before hydration runs and
// can make a click land before the onClick handler is attached.
async function openCreateTopicDialog(page: import("@playwright/test").Page) {
  await page.goto("/topics");
  const trigger = page.getByRole("button", { name: "New topic" });
  // Generous timeout: this is sometimes the first navigation to this route
  // in the whole run, and the dev server's on-demand compile of a page with
  // this many imports can outrun the default 5s expect timeout.
  await expect(page.getByText("Loading your topics")).toHaveCount(0, { timeout: 20_000 });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Create a study topic" });
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

test("create-topic dialog has no automatically detectable a11y violations", async ({ page }) => {
  await openCreateTopicDialog(page);
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test("Escape closes the create-topic dialog and returns focus to its trigger", async ({ page }) => {
  const { trigger, dialog } = await openCreateTopicDialog(page);

  await page.keyboard.press("Escape");

  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("Tab stays trapped inside the create-topic dialog", async ({ page }) => {
  await openCreateTopicDialog(page);

  // Cycle through every focusable control in the dialog, plus a couple extra
  // Tabs past the last one -- focus must never land outside the dialog.
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    const activeIsInsideDialog = await page.evaluate(() => {
      // Some dialog-role elements (e.g. the mobile nav's "more" sheet) stay
      // mounted in the DOM at all times and appear earlier than this one, so
      // a plain querySelector for the first "[role=dialog]" can grab the
      // wrong, hidden element -- filter to rendered dialogs and take the
      // topmost, matching GlobalDialogFocusTrap's own logic.
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).filter(
        (el) => getComputedStyle(el).display !== "none",
      );
      const dialogEl = dialogs[dialogs.length - 1];
      return !!dialogEl && dialogEl.contains(document.activeElement);
    });
    expect(activeIsInsideDialog).toBe(true);
  }
});
