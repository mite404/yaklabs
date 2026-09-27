import { APIError, type Anthropic } from "@anthropic-ai/sdk";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { validator } from "hono/validator";
import type { TokenVerifier } from "./auth";
import { gatewayRequestSchema, type GatewayRequest } from "./contract";

// What the gateway needs from outside: the Worker passes the real ones, tests pass fakes.
type Dependencies = { verifyToken: TokenVerifier; anthropic: Anthropic };

// The gateway owns the model and every request setting (ADR-085); the browser sends only turns.
const MODEL = "claude-opus-5";
// A cost cap for one chat reply, thinking included.
const MAX_TOKENS = 8192;
// `MessageStream.toReadableStream()` writes one JSON event per line, which the browser reads
// back with `MessageStream.fromReadableStream()`.
const NDJSON = "application/x-ndjson";

// `Authorization: Bearer <token>` → the token; a missing or other header → undefined.
const bearerToken = (header: string | undefined): string | undefined =>
  /^Bearer\s+(\S+)$/i.exec(header ?? "")?.[1];

// Whether the header carries a token the verifier accepts; a verifier that throws means no.
const isAuthorized = async (
  verifyToken: TokenVerifier,
  header: string | undefined,
): Promise<boolean> => {
  const token = bearerToken(header); // → string | undefined
  if (token === undefined) return false;
  try {
    await verifyToken(token); // → VerifiedSession, or throws
    return true;
  } catch {
    return false;
  }
};

// Starts the model's reply and waits for the upstream to accept the request, so a refusal
// becomes a status code before a byte of the body is sent.
const openReply = async (
  anthropic: Anthropic,
  { system, messages }: GatewayRequest,
): Promise<ReadableStream> => {
  const reply = anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    ...(system === "" ? {} : { system }), // an empty prompt is no prompt
    messages,
  }); // → MessageStream, request in flight
  // Read before the first event can arrive: the stream hands events only to readers it has.
  const body = reply.toReadableStream(); // → ReadableStream of NDJSON events
  await reply.withResponse(); // → the upstream's 2xx response, or throws Anthropic.APIError
  return body;
};

/**
 * Builds the gateway (ADR-085): the one server in the slice. It checks the caller's WorkOS
 * token, forwards the turns to the model with the key it holds, streams the reply back and
 * stores nothing. The route table is the contract the browser's typed client compiles against
 * (ADR-086).
 */
export const createApp = ({ verifyToken, anthropic }: Dependencies) => {
  const requireSession = createMiddleware(async (c, next) => {
    if (await isAuthorized(verifyToken, c.req.header("Authorization"))) return next();
    return c.json({ error: "unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });
  });

  return new Hono()
    .get("/api/health", (c) => c.json({ ok: true }))
    .post(
      "/api/messages",
      requireSession,
      validator("json", (value, c) => {
        const parsed = gatewayRequestSchema.safeParse(value); // → { success, data | error }
        return parsed.success ? parsed.data : c.json({ error: "invalid request" }, 400);
      }),
      async (c) => {
        try {
          const body = await openReply(anthropic, c.req.valid("json")); // → NDJSON stream
          return c.body(body, 200, { "Content-Type": NDJSON });
        } catch (error) {
          if (!(error instanceof APIError)) throw error;
          // The status alone: the upstream's body could echo the request, and the key stays
          // here. A network failure has no status.
          const status = typeof error.status === "number" ? error.status : null; // → number|null
          return c.json({ error: "upstream", status }, 502);
        }
      },
    );
};

/** The route table, for Hono's typed client in the browser (ADR-086). */
export type AppType = ReturnType<typeof createApp>;
