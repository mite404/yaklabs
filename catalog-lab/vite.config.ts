/// <reference types="vitest/config" />
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite";

// Two pages: the lab, and the public page that shows one shared card (ADR-064).
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { main: "index.html", share: "share.html" },
    },
  },
  test: {
    projects: [
      { extends: true, test: { name: "unit", include: ["src/**/*.test.{ts,tsx}"] } },
      // Every story renders in headless Chromium, runs its play function, and passes axe.
      {
        extends: true,
        plugins: [storybookTest()],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
