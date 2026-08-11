import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // The production preview server (`vinext start`) is built for this app's
    // Cloudflare Workers target and doesn't serve /assets/* correctly when
    // run as a plain Node process outside that runtime -- every client JS/CSS
    // request 404s, which silently only matters for tests that need working
    // client-side interactivity (everything before this was SSR-content-only
    // assertions). The dev server serves assets correctly and is what this
    // suite was actually exercised against.
    command: "npm run dev -- --port 4174 --hostname 127.0.0.1",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
