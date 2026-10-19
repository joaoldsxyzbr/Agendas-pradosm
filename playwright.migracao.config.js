import { defineConfig, devices } from "@playwright/test";
const baseURL = "http://127.0.0.1:8789";
export default defineConfig({
  testDir: "./tests/migracao-browser", workers: 1, fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  webServer: {
    command: "npm run migracao:build && npx wrangler dev --config wrangler.migracao.jsonc --ip 127.0.0.1 --port 8789",
    url: baseURL + "/login", reuseExistingServer: !process.env.CI, timeout: 120000,
    env: { SESSION_SECRET: "agendas-prado-migracao-e2e-somente-local" }
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
