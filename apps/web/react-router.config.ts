import type { Config } from "@react-router/dev/config";

// A static single-page app (ADR-083): the worker, OPFS and SQLite exist only in the browser.
export default {
  appDirectory: "src",
  ssr: false,
} satisfies Config;
