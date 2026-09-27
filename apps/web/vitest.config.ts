import { defineConfig } from "vitest/config";

// Node unit tests only; the React Router plugin in vite.config.ts is for the app itself.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
