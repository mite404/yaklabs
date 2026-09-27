import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tailwindcss(), reactRouter()],
  optimizeDeps: {
    // The worker loads sqlite-wasm's wasm and helper files itself; pre-bundling breaks them.
    exclude: ["@sqlite.org/sqlite-wasm"],
    // Vite's scan does not follow `new Worker(new URL(...))`, so the worker's two dependencies
    // are named here; found late, they would reload the page mid-conversation.
    include: [
      "@yaklabs/runtime > hono/client",
      "@yaklabs/runtime > @anthropic-ai/sdk/lib/MessageStream",
    ],
  },
  // A module worker (ADR-083), so the runtime's worker can import like any other module.
  worker: { format: "es" },
});
