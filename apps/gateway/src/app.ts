import { APIError, type Anthropic } from "@anthropic-ai/sdk";
import { Hono } from "hono";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { validator } from "hono/validator";
import type { TokenVerifier } from "./auth";
import { gatewayRequestSchema, type GatewayRequest } from "./contract";
import { createShare, readShare, revokeShare, type ShareAnswer, type ShareDeps } from "./shares";

// What the gateway needs from outside: the Worker passes the real ones, tests pass fakes.
// `upstream` speaks the Anthropic Messages format, whoever serves it (`openRouterClient`).
type Dependencies = { verifyToken: TokenVerifier; upstream: Anthropic; shares: ShareDeps };

// The gateway owns the model and every request setting (ADR-085); the browser sends only turns.
// Kimi K2.6 through OpenRouter, for its price (ADR-146). It reasons before it answers, and the
// browser shows only the answer's text.
const MODEL = "moonshotai/kimi-k2.6";
// A cost cap for one chat reply, reasoning included.
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
  upstream: Anthropic,
  { system, messages }: GatewayRequest,
): Promise<ReadableStream> => {
  const reply = upstream.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    ...(system === "" ? {} : { system }), // an empty prompt is no prompt
    messages,
  }); // → MessageStream, request in flight
  // Read before the first event can arrive: the stream hands events only to readers it has.
  const body = reply.toReadableStream(); // → ReadableStream of NDJSON events
  await reply.withResponse(); // → the upstream's 2xx response, or throws APIError
  return body;
};

// A share route's answer as a response. The sealed bytes are never cached anywhere, so a share
// taken down or ended is gone from every copy at once (ADR-131).
function shareResponse(c: Context, answer: ShareAnswer): Response {
  if (answer.status === 200) {
    return c.body(answer.bytes, 200, {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Expires-At": answer.expiresAt,
    });
  }
  if (answer.status === 204) return c.body(null, 204);
  return c.json(answer.json, answer.status);
}

/**
 * Builds the gateway (ADR-085): the one server in the slice. It checks the caller's WorkOS
 * token, forwards the turns to the model with the key it holds, and streams the reply back;
 * it stores no turn. The one thing it keeps is a thread made public, sealed with a key it never
 * sees, until the share ends (ADR-131). The route table is the contract the browser's typed
 * client compiles against (ADR-086).
 */
export const createApp = ({ verifyToken, upstream, shares }: Dependencies) => {
  const requireSession = createMiddleware(async (c, next) => {
    if (await isAuthorized(verifyToken, c.req.header("Authorization"))) return next();
    return c.json({ error: "unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });
  });

  return (
    new Hono()
      .get("/api/health", (c) => c.json({ ok: true }))
      // A thread made public for a while (ADR-131): only a signed-in visitor may keep one, anyone
      // with the link may read it, and its revoke token takes it down early.
      .post("/api/shares", requireSession, async (c) =>
        shareResponse(c, await createShare(shares, c.req.query("ttl"), await c.req.arrayBuffer())),
      )
      .get("/api/shares/:id", async (c) =>
        shareResponse(c, await readShare(shares, c.req.param("id"))),
      )
      .delete("/api/shares/:id", async (c) =>
        shareResponse(
          c,
          await revokeShare(shares, c.req.param("id"), c.req.header("X-Revoke-Token")),
        ),
      )
      .post(
        "/api/messages",
        requireSession,
        validator("json", (value, c) => {
          const parsed = gatewayRequestSchema.safeParse(value); // → { success, data | error }
          return parsed.success ? parsed.data : c.json({ error: "invalid request" }, 400);
        }),
        async (c) => {
          try {
            const body = await openReply(upstream, c.req.valid("json")); // → NDJSON stream
            return c.body(body, 200, { "Content-Type": NDJSON });
          } catch (error) {
            if (!(error instanceof APIError)) throw error;
            // The status alone: the upstream's body could echo the request, and the key stays
            // here. A network failure has no status.
            const status = typeof error.status === "number" ? error.status : null; // → number|null
            return c.json({ error: "upstream", status }, 502);
          }
        },
      )
  );
};

/** The route table, for Hono's typed client in the browser (ADR-086). */
export type AppType = ReturnType<typeof createApp>;
