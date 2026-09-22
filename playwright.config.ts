import { defineConfig } from "@playwright/test";

/**
 * End-to-end browser tests (e2e/). Runs the real app on its own dev server
 * port and drives the installed Google Chrome — no Playwright browser download.
 * The Turso/Worker backend is replaced per test by an in-memory fake
 * (e2e/fakeWorker.ts), so no test data ever reaches the real database.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5188",
    channel: "chrome",
    viewport: { width: 1280, height: 860 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5188 --strictPort",
    url: "http://localhost:5188/clinical",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
