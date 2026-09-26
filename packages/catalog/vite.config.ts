/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Two pages: the lab, and the public page that shows one shared card (ADR-064).
// Stories run from apps/storybook; only the node unit tests live here.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { main: "index.html", share: "share.html" },
    },
  },
  test: { include: ["src/**/*.test.{ts,tsx}"] },
});
