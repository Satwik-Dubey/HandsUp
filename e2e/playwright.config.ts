import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke test: a teacher runs a lecture and a student takes part, in real browsers.
 * Needs Postgres and Redis running and migrated (`pnpm db:up && pnpm db:migrate`).
 * Starts `pnpm dev` itself unless the app is already running on :3000.
 */
export default defineConfig({
  testDir: ".",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "../playwright-report" }]] : "list",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: {
    command: "pnpm dev",
    cwd: "..",
    url: "http://localhost:4000/health",
    reuseExistingServer: true,
    timeout: 240_000,
    env: { LOCAL_MODELS: "off" },
  },
});
