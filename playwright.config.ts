import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: externalBaseURL ?? "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...(externalBaseURL === undefined
    ? {
        webServer: {
          command: "bun run dev -- --host 127.0.0.1",
          reuseExistingServer: !process.env.CI,
          stderr: "pipe",
          stdout: "pipe",
          timeout: 120_000,
          url: "http://127.0.0.1:5173/api/health",
        },
      }
    : {}),
});
