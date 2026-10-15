import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "tests/ui/parse-agenda-batch.test.js",
      "tests/ui/export-agenda-pdf.test.js",
    ],
    environment: "jsdom",
  },
});
