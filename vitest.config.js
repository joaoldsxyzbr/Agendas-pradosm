import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations("migrations");
      return {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            SESSION_SECRET: "agenda-prado-test-session-secret",
            REALTIME_MODE: "on",
          },
        },
      };
    }),
  ],
  test: {
    include: [
      "tests/worker/**/*.test.js",
      "tests/ui/parser.test.js",
      "tests/ui/extract-pdf.test.js",
    ],
    setupFiles: ["./tests/setup/migrations.js"],
  },
});
