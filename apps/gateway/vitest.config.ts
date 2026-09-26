import { defineConfig } from "vitest/config";

// Unit tests run in node: Hono's `app.request` drives the routes without starting workerd.
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
