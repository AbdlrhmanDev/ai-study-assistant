import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

const widths = [320, 375, 768, 1024, 1440] as const;
const publicRoutes = ["/", "/login", "/register"] as const;

for (const width of widths) {
  test(`public layouts fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });

    for (const route of publicRoutes) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();

      const overflow = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
      }));
      expect(overflow.page, `${route} has horizontal overflow at ${width}px`).toBeLessThanOrEqual(overflow.viewport);
    }
  });
}

test("landing navigation is touch-friendly on mobile and expanded on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const menu = page.locator(".landing-mobile-menu summary");
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await menu.click();
  await expect(page.locator(".landing-mobile-menu a[href='#features']")).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(menu).toBeHidden();
  await expect(page.locator(".nav-links")).toBeVisible();
});

test("Studia overview becomes a mobile study home without losing desktop navigation", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard");
  await expect(page.locator(".mobile-welcome h1")).toContainText("Learner");
  await expect(page.getByRole("link", { name: "Studia home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open profile settings" })).toBeVisible();
  await expect(page.getByPlaceholder("Search your topics...")).toBeHidden();
  await expect(page.getByRole("region", { name: "Recommended study actions" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Quick navigation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  await page.getByRole("button", { name: "Open more navigation" }).click();
  await expect(page.getByRole("dialog", { name: "More" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "More study tools" })).toContainText("Flashcards");
  await page.getByRole("button", { name: "Close more navigation" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  await page.goto("/topics");
  const mobileNavigation = page.getByRole("navigation", { name: "Quick navigation" });
  await expect(mobileNavigation).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Topics", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator(".dash-top")).toBeVisible();
  await expect(page.locator(".mobile-app-header")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Quick navigation" })).toBeHidden();
  await expect(page.getByRole("region", { name: "Recommended study actions" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  await expect(page.locator('aside[aria-label="Primary navigation"]')).toBeVisible();
});
