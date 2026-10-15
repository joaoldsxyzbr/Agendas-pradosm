import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --ip 127.0.0.1 --port 5173",
    url: baseURL + "/",
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      SESSION_SECRET: process.env.SESSION_SECRET ?? "agenda-prado-e2e-session-secret",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
