import { Hono } from "hono";
import { validator } from "hono/validator";
import { gatewayRequestSchema } from "./contract";

// Secrets and settings the Worker reads from its environment (wrangler.jsonc, .dev.vars).
type Bindings = {
  ANTHROPIC_API_KEY: string;
  WORKOS_CLIENT_ID: string;
};

/**
 * The gateway (ADR-085): the one server in the slice. It checks the caller's WorkOS token,
 * forwards the turn to the model with the key it holds, streams the reply back and stores
 * nothing. The route shape here is the contract the browser's typed client compiles against.
 */
export const app = new Hono<{ Bindings: Bindings }>()
  .get("/api/health", (c) => c.json({ ok: true }))
  .post(
    "/api/messages",
    validator("json", (value, c) => {
      const parsed = gatewayRequestSchema.safeParse(value); // → { success, data } | { success, error }
      return parsed.success ? parsed.data : c.json({ error: "invalid request" }, 400);
    }),
    (c) => c.json({ error: "not implemented" }, 501),
  );

/** The route table, for Hono's typed client in the browser (ADR-086). */
export type AppType = typeof app;
