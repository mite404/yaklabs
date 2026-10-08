import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import type { Ack, Relay, SessionHandle } from "./relay.ts";

/** Where and for whom the browser relay listens. */
export type RelayHttpOptions = {
  relay: Relay;
  /** Port on 127.0.0.1; 0 picks a free one. */
  port: number;
  /** The one browser Origin allowed to talk to the relay, such as http://localhost:5173. */
  origin: string;
};

/** A listening relay. */
export type RelayHttp = { port: number; close(): Promise<void> };

const MAX_BODY = 128 * 1024;

const openSchema = z.strictObject({
  threadId: z.string().trim().min(1).max(200),
  title: z.string().max(400),
});

const ackSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    insertionId: z.uuid(),
    ok: z.literal(true),
    threadId: z.string().min(1).max(200),
    messageId: z.string().min(1).max(300),
    note: z.string().max(1000).optional(),
  }),
  z.strictObject({
    insertionId: z.uuid(),
    ok: z.literal(false),
    error: z.string().trim().min(1).max(1000),
  }),
]);

// An HTTP failure with the status the browser sees.
class Refusal extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function reply(res: ServerResponse, status: number, body?: unknown) {
  res.statusCode = status;
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-content-type-options", "nosniff");
  if (body === undefined) {
    res.end();
    return;
  }
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<unknown> {
  const type = req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
  if (type !== "application/json") throw new Refusal(415, "Send the body as application/json.");
  if (Number(req.headers["content-length"] ?? 0) > MAX_BODY)
    throw new Refusal(413, "Body is larger than 128 KiB.");
  return new Promise((done, fail) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        fail(new Refusal(413, "Body is larger than 128 KiB."));
        req.removeAllListeners("data");
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("error", fail);
    req.on("end", () => {
      try {
        done(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
      } catch {
        fail(new Refusal(400, "Body is not valid JSON."));
      }
    });
  });
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Refusal(400, z.prettifyError(parsed.error));
  return parsed.data;
}

function bearer(req: IncomingMessage): string | undefined {
  const match = /^Bearer ([0-9a-f-]{36})$/i.exec(req.headers.authorization ?? "");
  return match?.[1];
}

/**
 * Starts the browser relay on 127.0.0.1. It answers only same-origin requests (no CORS), only
 * under a localhost Host for its own port, and logs no credentials.
 * @throws When the port cannot be bound.
 */
export async function startRelayHttp({
  relay,
  port,
  origin,
}: RelayHttpOptions): Promise<RelayHttp> {
  let bound = port;

  function checkHost(req: IncomingMessage) {
    const allowed = [`localhost:${bound}`, `127.0.0.1:${bound}`];
    if (!allowed.includes(req.headers.host?.toLowerCase() ?? ""))
      throw new Refusal(403, "Unexpected Host.");
  }

  function checkOrigin(req: IncomingMessage, required: boolean) {
    const given = req.headers.origin;
    if (given === undefined ? required : given !== origin)
      throw new Refusal(403, "Origin not allowed.");
  }

  function authorize(req: IncomingMessage, code: string): SessionHandle {
    const token = bearer(req);
    const session = token === undefined ? undefined : relay.authorize(code, token);
    if (session === undefined) throw new Refusal(401, "Unknown or expired session.");
    return session;
  }

  async function sessionRequest(
    req: IncomingMessage,
    res: ServerResponse,
    session: SessionHandle,
    action: string | undefined,
  ) {
    if (action === "/next") {
      reply(res, 200, relay.next(session));
      return;
    }
    if (action === "/ack") {
      const ack: Ack = parse(ackSchema, await readBody(req));
      const outcome = relay.ack(session, ack);
      if (outcome === "not-pending")
        throw new Refusal(409, "No pending card with that insertionId.");
      if (outcome === "mismatch") throw new Refusal(409, "Ack does not match the bound thread.");
    } else {
      relay.revoke(session);
    }
    reply(res, 204);
  }

  async function route(req: IncomingMessage, res: ServerResponse) {
    checkHost(req);
    const path = new URL(req.url ?? "/", "http://relay").pathname;
    const method = req.method;

    if (path === "/sessions") {
      if (method !== "POST") throw new Refusal(405, "Method not allowed.");
      checkOrigin(req, true);
      const { threadId } = parse(openSchema, await readBody(req));
      const session = relay.open(threadId);
      if (session === undefined) throw new Refusal(503, "Too many open sessions.");
      reply(res, 201, session);
      return;
    }

    const match = /^\/sessions\/([^/]+)(\/next|\/ack)?$/.exec(path);
    if (match === null) throw new Refusal(404, "Not found.");
    const [, code = "", action] = match;
    const allowed = action === "/next" ? "GET" : action === "/ack" ? "POST" : "DELETE";
    if (method !== allowed) throw new Refusal(405, "Method not allowed.");
    checkOrigin(req, false);
    const session = authorize(req, code);
    return sessionRequest(req, res, session, action);
  }

  const server = createServer((req, res) => {
    route(req, res).catch((error: unknown) => {
      if (error instanceof Refusal) {
        reply(res, error.status, { error: error.message });
        return;
      }
      process.stderr.write(`bonsai-mcp: relay request failed: ${String(error)}\n`);
      reply(res, 500, { error: "Internal error." });
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;

  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", fail);
      done();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Relay has no TCP address");
  bound = address.port;

  return {
    port: bound,
    close: () =>
      new Promise((done) => {
        server.close(() => {
          done();
        });
        server.closeAllConnections();
      }),
  };
}
