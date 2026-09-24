import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations("migrations");

      return {
        wrangler: {
          configPath: "./wrangler.jsonc",
        },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            SESSION_SECRET: "agenda-prado-test-session-secret",
          },
        },
      };
    }),
  ],
  test: {
    include: [
      "tests/worker/**/*.test.ts",
      "tests/ui/parser.test.ts",
      "tests/ui/extract-pdf.test.ts",
    ],
    setupFiles: ["./tests/setup/migrations.ts"],
  },
});
