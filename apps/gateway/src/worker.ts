import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createApp, type AppType } from "./app";
import { workOsVerifier } from "./auth";

// The Worker's bindings: `WORKOS_CLIENT_ID` is a var in wrangler.jsonc, `ANTHROPIC_API_KEY` a
// secret (`wrangler secret put`); `.dev.vars` supplies both under `wrangler dev`.
type Env = { ANTHROPIC_API_KEY: string; WORKOS_CLIENT_ID: string };

// Both must be set, and a WorkOS client id (not its API key) must go in the client id slot.
const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  WORKOS_CLIENT_ID: z.string().startsWith("client_"),
});

// One app per isolate: the JWKS cache and the SDK client live as long as the isolate does.
let app: AppType | undefined;

// Builds the app from the bindings, or throws naming the binding that is missing or wrong.
const appFor = (env: Env): AppType => {
  const { ANTHROPIC_API_KEY, WORKOS_CLIENT_ID } = envSchema.parse(env); // → Env, or throws
  return createApp({
    verifyToken: workOsVerifier(WORKOS_CLIENT_ID),
    // Pinned so an `ANTHROPIC_LOG=debug` binding cannot log request bodies (ADR-085).
    anthropic: new Anthropic({ apiKey: ANTHROPIC_API_KEY, logLevel: "warn" }),
  });
};

/**
 * The Cloudflare Workers entry (ADR-086). Static files never reach it; `run_worker_first` sends
 * `/api/*` here and the assets binding serves the rest.
 *
 * @throws when `ANTHROPIC_API_KEY` or `WORKOS_CLIENT_ID` is missing or malformed.
 */
export default {
  fetch(request, env, ctx) {
    app ??= appFor(env); // → AppType, built on the first request
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
