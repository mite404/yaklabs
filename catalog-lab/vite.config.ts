import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Two pages: the lab, and the public page that shows one shared card (ADR-064).
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { main: "index.html", share: "share.html" },
    },
  },
});
