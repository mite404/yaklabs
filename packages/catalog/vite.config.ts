/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Only the node unit tests run here; stories run from apps/storybook and pages from apps/web.
export default defineConfig({
  plugins: [react()],
  test: { include: ["src/**/*.test.{ts,tsx}"] },
});
