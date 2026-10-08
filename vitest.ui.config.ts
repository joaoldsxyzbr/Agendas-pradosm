import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/ui/**/*.test.ts", "tests/ui/**/*.test.tsx"],
    exclude: ["tests/ui/parser.test.ts", "tests/ui/extract-pdf.test.ts"],
    environment: "jsdom",
  },
});
