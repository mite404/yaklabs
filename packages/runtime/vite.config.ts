/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// Pure logic and the in-memory store run in node.
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.browser.test.ts"],
        },
      },
    ],
  },
});
