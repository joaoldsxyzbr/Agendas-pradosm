import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/ui/**/*.test.tsx", "tests/ui/design-system.test.ts"],
    environment: "jsdom",
  },
});
