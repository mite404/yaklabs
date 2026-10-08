import { randomUUID } from "node:crypto";
import { request } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { agentSchema, type Selection } from "@yaklabs/catalog/catalog";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { startRelayHttp } from "./http.ts";
import { createMcpServer } from "./mcp.ts";
import { createRelay, type RelayOptions } from "./relay.ts";

const ORIGIN = "http://localhost:5173";
const THREAD = "thread-1";
const sessionSchema = z.object({ code: z.uuid(), browserToken: z.uuid(), expiresAt: z.string() });
const deliveredSchema = z.object({ insertionId: z.uuid(), card: z.unknown() });
const catalogSchema = z.object({
  catalogVersion: z.string(),
  components: z.array(z.object({ name: z.string(), description: z.string() })),
  rules: z.array(z.string()),
  schema: z.unknown(),
});

const lineCard = {
  catalogVersion: "1",
  component: "LineChart",
  props: {
    title: "Cases closed",
    source: "Example service desk",
    unit: "cases",
    variant: "trend",
    rows: [
      { label: "Mon", value: 12 },
      { label: "Tue", value: 7 },
    ],
  },
} satisfies Selection;

type Reply = { status: number; body: unknown; headers: Record<string, unknown> };
type Call = {
  method: string;
  path: string;
  origin?: string | null;
  host?: string;
  token?: string;
  body?: unknown;
  raw?: string;
  contentType?: string;
};

type Harness = {
  client: Client;
  port: number;
  http(call: Call): Promise<Reply>;
  open(threadId?: string): Promise<{ code: string; browserToken: string; expiresAt: string }>;
  insert(args: Record<string, unknown>): Promise<CallToolResult>;
};

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).toReversed()) await cleanup();
});

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

// A real HTTP request with full control of Host and Origin, as a browser or attacker sends it.
function send(port: number, call: Call): Promise<Reply> {
  const headers: Record<string, string> = { host: call.host ?? `localhost:${port}` };
  if (call.origin !== null) headers.origin = call.origin ?? ORIGIN;
  if (call.token !== undefined) headers.authorization = `Bearer ${call.token}`;
  const payload = call.raw ?? (call.body === undefined ? undefined : JSON.stringify(call.body));
  if (payload !== undefined) headers["content-type"] = call.contentType ?? "application/json";
  return new Promise((done, fail) => {
    const req = request(
      { host: "127.0.0.1", port, method: call.method, path: call.path, headers },
      (res) => {
        let bodyText = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (bodyText += chunk));
        res.on("end", () => {
          done({
            status: res.statusCode ?? 0,
            body: bodyText === "" ? undefined : (JSON.parse(bodyText) as unknown),
            headers: res.headers,
          });
        });
      },
    );
    req.on("error", fail);
    req.end(payload);
  });
}

async function harness(options: RelayOptions = {}): Promise<Harness> {
  const relay = createRelay(options);
  const http = await startRelayHttp({ relay, port: 0, origin: ORIGIN });
  const server = createMcpServer({ relay });
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  await client.connect(clientSide);
  cleanups.push(async () => {
    await client.close();
    await server.close();
    await http.close();
    relay.close();
  });
  const call = (c: Call) => send(http.port, c);
  return {
    client,
    port: http.port,
    http: call,
    async open(threadId = THREAD) {
      const reply = await call({
        method: "POST",
        path: "/sessions",
        body: { threadId, title: "Weekly cases" },
      });
      expect(reply.status).toBe(201);
      return sessionSchema.parse(reply.body);
    },
    insert: async (args) =>
      CallToolResultSchema.parse(await client.callTool({ name: "insert_card", arguments: args })),
  };
}

function text(result: CallToolResult): string {
  return result.content.map((block) => (block.type === "text" ? block.text : "")).join("\n");
}

// Polls like the browser worker until a card arrives.
async function nextCard(h: Harness, code: string, token: string) {
  for (let i = 0; i < 50; i++) {
    const reply = await h.http({ method: "GET", path: `/sessions/${code}/next`, token });
    expect(reply.status).toBe(200);
    if (reply.body !== null) return deliveredSchema.parse(reply.body);
    await sleep(10);
  }
  throw new Error("no card delivered");
}

describe("tool discovery", () => {
  it("lists both tools and the catalog with no browser connected", async () => {
    const h = await harness();
    const { tools } = await h.client.listTools();
    expect(tools.map((tool) => tool.name).toSorted()).toEqual(["insert_card", "list_components"]);
    const insert = tools.find((tool) => tool.name === "insert_card");
    expect(insert?.inputSchema.required).toEqual(["connectionCode", "insertionId", "card"]);

    const result = CallToolResultSchema.parse(
      await h.client.callTool({
        name: "list_components",
        arguments: {},
      }),
    );
    expect(result.isError).toBeFalsy();
    const catalog = catalogSchema.parse(result.structuredContent);
    expect(catalog.catalogVersion).toBe("1");
    expect(catalog.components.map((c) => c.name)).toEqual(["LineChart", "BarChart", "DataTable"]);
    for (const component of catalog.components)
      expect(component.description.length).toBeGreaterThan(20);
    expect(catalog.schema).toEqual(agentSchema);
    expect(JSON.parse(text(result))).toEqual(catalog);
  });
});

describe("browser session", () => {
  it("issues separate random credentials with a 15 minute expiry", async () => {
    const h = await harness();
    const before = Date.now();
    const session = await h.open();
    expect(session.code).toMatch(/^[0-9a-f-]{36}$/);
    expect(session.browserToken).toMatch(/^[0-9a-f-]{36}$/);
    expect(session.code).not.toBe(session.browserToken);
    const expires = Date.parse(session.expiresAt);
    expect(expires - before).toBeGreaterThan(14.9 * 60_000);
    expect(expires - before).toBeLessThanOrEqual(15 * 60_000 + 1000);
  });

  it("sends no CORS headers and refuses preflight", async () => {
    const h = await harness();
    const reply = await h.http({ method: "OPTIONS", path: "/sessions" });
    expect(reply.status).toBe(405);
    const session = await h.http({
      method: "POST",
      path: "/sessions",
      body: { threadId: THREAD, title: "t" },
    });
    expect(Object.keys(session.headers).filter((k) => k.startsWith("access-control"))).toEqual([]);
  });

  it("requires the exact configured Origin to open a session", async () => {
    const h = await harness();
    const body = { threadId: THREAD, title: "t" };
    for (const origin of [null, "http://localhost:5174", "http://evil.test", "null"]) {
      const reply = await h.http({ method: "POST", path: "/sessions", origin, body });
      expect(reply.status).toBe(403);
    }
  });

  it("rejects a foreign Host header against DNS rebinding", async () => {
    const h = await harness();
    const body = { threadId: THREAD, title: "t" };
    for (const host of [
      "evil.test",
      `evil.test:${h.port}`,
      `localhost:${h.port + 1}`,
      "localhost",
    ]) {
      const reply = await h.http({ method: "POST", path: "/sessions", host, body });
      expect(reply.status).toBe(403);
    }
    const ok = await h.http({
      method: "POST",
      path: "/sessions",
      host: `127.0.0.1:${h.port}`,
      body,
    });
    expect(ok.status).toBe(201);
  });

  it("validates the session body", async () => {
    const h = await harness();
    for (const body of [
      {},
      { threadId: "", title: "t" },
      { threadId: THREAD },
      { threadId: 1, title: "t" },
      { threadId: THREAD, title: "t", extra: 1 },
    ]) {
      const reply = await h.http({ method: "POST", path: "/sessions", body });
      expect(reply.status).toBe(400);
    }
    const notJson = await h.http({ method: "POST", path: "/sessions", raw: "{" });
    expect(notJson.status).toBe(400);
    const wrongType = await h.http({
      method: "POST",
      path: "/sessions",
      raw: JSON.stringify({ threadId: THREAD, title: "t" }),
      contentType: "text/plain",
    });
    expect(wrongType.status).toBe(415);
  });

  it("refuses a body over 128 KiB", async () => {
    const h = await harness();
    const reply = await h.http({
      method: "POST",
      path: "/sessions",
      raw: JSON.stringify({ threadId: THREAD, title: "x".repeat(129 * 1024) }),
    });
    expect(reply.status).toBe(413);
  });

  it("caps the number of open sessions", async () => {
    const h = await harness({ maxSessions: 2 });
    await h.open();
    await h.open();
    const reply = await h.http({
      method: "POST",
      path: "/sessions",
      body: { threadId: THREAD, title: "t" },
    });
    expect(reply.status).toBe(503);
  });

  it("authorizes browser calls only with the browser token", async () => {
    const h = await harness();
    const { code, browserToken } = await h.open();
    const path = `/sessions/${code}/next`;
    expect((await h.http({ method: "GET", path })).status).toBe(401);
    expect((await h.http({ method: "GET", path, token: code })).status).toBe(401);
    expect((await h.http({ method: "GET", path, token: randomUUID() })).status).toBe(401);
    expect(
      (await h.http({ method: "GET", path: `/sessions/${browserToken}/next`, token: browserToken }))
        .status,
    ).toBe(401);
    expect((await h.http({ method: "GET", path, token: browserToken, origin: null })).status).toBe(
      200,
    );
  });

  it("rejects a wrong Origin even with a valid browser token", async () => {
    const h = await harness();
    const { code, browserToken } = await h.open();
    const reply = await h.http({
      method: "GET",
      path: `/sessions/${code}/next`,
      token: browserToken,
      origin: "http://evil.test",
    });
    expect(reply.status).toBe(403);
  });

  it("expires a session nobody polls", async () => {
    const h = await harness({ idleMs: 100 });
    const { code, browserToken } = await h.open();
    await sleep(200);
    const reply = await h.http({
      method: "GET",
      path: `/sessions/${code}/next`,
      token: browserToken,
    });
    expect(reply.status).toBe(401);
  });

  it("expires a session at its lifetime even while polled", async () => {
    const h = await harness({ sessionTtlMs: 200, idleMs: 1000 });
    const { code, browserToken } = await h.open();
    const path = `/sessions/${code}/next`;
    for (let i = 0; i < 6; i++) {
      await sleep(50);
      expect((await h.http({ method: "GET", path, token: browserToken })).status).toBeLessThan(500);
    }
    expect((await h.http({ method: "GET", path, token: browserToken })).status).toBe(401);
  });
});

describe("insert_card", () => {
  it("rejects changed data under an insertionId that is still pending", async () => {
    const h = await harness();
    const { code, browserToken } = await h.open();
    const insertionId = randomUUID();
    const first = h.insert({ connectionCode: code, insertionId, card: lineCard });
    await nextCard(h, code, browserToken);
    const changed = h.insert({
      connectionCode: code,
      insertionId,
      card: {
        ...lineCard,
        props: { ...lineCard.props, title: "Different card" },
      },
    });
    await sleep(20);
    await h.http({
      method: "POST",
      path: `/sessions/${code}/ack`,
      token: browserToken,
      body: { insertionId, ok: true, threadId: THREAD, messageId: `mcp:${insertionId}` },
    });
    expect((await first).isError).toBeFalsy();
    const result = await changed;
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("different card");
  });

  it("does not queue a pre-cancelled call and reports cancellation after delivery as unknown", async () => {
    const relay = createRelay();
    try {
      const session = relay.open(THREAD);
      if (session === undefined) throw new Error("Session did not open");
      const handle = relay.authorize(session.code, session.browserToken);
      if (handle === undefined) throw new Error("Session did not authorize");
      const cancelled = await relay.insert(
        session.code,
        randomUUID(),
        lineCard,
        AbortSignal.abort(),
      );
      expect(cancelled).toMatchObject({ ok: false });
      expect(relay.next(handle)).toBeNull();
      const controller = new AbortController();
      const insertionId = randomUUID();
      const pending = relay.insert(session.code, insertionId, lineCard, controller.signal);
      expect(relay.next(handle)).toEqual({ insertionId, card: lineCard });
      controller.abort();
      const outcome = await pending;
      expect(outcome.ok).toBe(false);
      if (outcome.ok) throw new Error("Cancelled insertion succeeded");
      expect(outcome.error).toContain("delivery is unknown");
    } finally {
      relay.close();
    }
  });

  it("succeeds only after the browser acknowledges persistence", async () => {
    const h = await harness();
    const { code, browserToken } = await h.open();
    const insertionId = randomUUID();
    let settled = false;
    const pending = h.insert({ connectionCode: code, insertionId, card: lineCard }).then((r) => {
      settled = true;
      return r;
    });
    const delivered = await nextCard(h, code, browserToken);
    expect(delivered).toEqual({ insertionId, card: lineCard });
    await sleep(50);
    expect(settled).toBe(false);
    // Delivered once: the browser worker owns retries through the stable insertionId.
    const again = await h.http({
      method: "GET",
      path: `/sessions/${code}/next`,
      token: browserToken,
    });
    expect(again.body).toBeNull();

    const ack = await h.http({
      method: "POST",
      path: `/sessions/${code}/ack`,
      token: browserToken,
      body: { insertionId, ok: true, threadId: THREAD, messageId: `mcp:${insertionId}` },
    });
    expect(ack.status).toBe(204);
    const result = await pending;
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      threadId: THREAD,
      messageId: `mcp:${insertionId}`,
      insertionId,
    });
  });

  it("joins a retry with the same insertionId to the pending call", async () => {
    const h = await harness();
    const { code, browserToken } = await h.open();
    const insertionId = randomUUID();
    const first = h.insert({ connectionCode: code, insertionId, card: lineCard });
    await nextCard(h, code, browserToken);
    const retry = h.insert({ connectionCode: code, insertionId, card: lineCard });
    await sleep(20);
    await h.http({
      method: "POST",
      path: `/sessions/${code}/ack`,
      token: browserToken,
      body: {
        insertionId,
        ok: true,
        threadId: THREAD,
        messageId: `mcp:${insertionId}`,
        note: "Saved.",
      },
    });
    for (const result of await Promise.all([first, retry])) {
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({ insertionId, note: "Saved." });
    }
  });

  it("falls back through resolve and reports why", async () => {
    const h = await harness();
    const { code, browserToken } = await h.open();
    const insertionId = randomUUID();
    const card = {
      ...lineCard,
      props: {
        ...lineCard.props,
        rows: [
          { label: "Mon", value: 12 },
          { label: "Tue", value: null },
        ],
      },
    };
    const pending = h.insert({ connectionCode: code, insertionId, card });
    const delivered = await nextCard(h, code, browserToken);
    expect(delivered.card).toEqual({
      catalogVersion: "1",
      component: "DataTable",
      props: { ...card.props, variant: "audit" },
    });
    await h.http({
      method: "POST",
      path: `/sessions/${code}/ack`,
      token: browserToken,
      body: { insertionId, ok: true, threadId: THREAD, messageId: `mcp:${insertionId}` },
    });
    const result = await pending;
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent?.note).toContain("two known observations");
  });

  it("refuses an invalid card with an actionable error and queues nothing", async () => {
    const h = await harness();
    const { code, browserToken } = await h.open();
    const result = await h.insert({
      connectionCode: code,
      insertionId: randomUUID(),
      card: { ...lineCard, component: "PieChart" },
    });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/card/);
    expect(text(result)).toMatch(/component/);
    const next = await h.http({
      method: "GET",
      path: `/sessions/${code}/next`,
      token: browserToken,
    });
    expect(next.body).toBeNull();
  });

  it("refuses malformed ids", async () => {
    const h = await harness();
    const { code } = await h.open();
    for (const args of [
      { connectionCode: "abc", insertionId: randomUUID(), card: lineCard },
      { connectionCode: code, insertionId: "1", card: lineCard },
    ]) {
      const result = await h.insert(args);
      expect(result.isError).toBe(true);
    }
  });

  it("refuses an unknown connection code and the browser token as a code", async () => {
    const h = await harness();
    const { browserToken } = await h.open();
    for (const connectionCode of [randomUUID(), browserToken]) {
      const result = await h.insert({ connectionCode, insertionId: randomUUID(), card: lineCard });
      expect(result.isError).toBe(true);
      expect(text(result)).toMatch(/connection code/i);
    }
  });

  it("fails when the ack names another thread or message", async () => {
    const h = await harness();
    const { code, browserToken } = await h.open();
    for (const wrong of [{ threadId: "thread-2" }, { messageId: "mcp:other" }]) {
      const insertionId = randomUUID();
      const pending = h.insert({ connectionCode: code, insertionId, card: lineCard });
      await nextCard(h, code, browserToken);
      const ack = await h.http({
        method: "POST",
        path: `/sessions/${code}/ack`,
        token: browserToken,
        body: {
          insertionId,
          ok: true,
          threadId: THREAD,
          messageId: `mcp:${insertionId}`,
          ...wrong,
        },
      });
      expect(ack.status).toBe(409);
      const result = await pending;
      expect(result.isError).toBe(true);
      expect(text(result)).toContain(insertionId);
    }
  });

  it("refuses an ack for an insertion that is not pending", async () => {
    const h = await harness();
    const { code, browserToken } = await h.open();
    const insertionId = randomUUID();
    const ack = await h.http({
      method: "POST",
      path: `/sessions/${code}/ack`,
      token: browserToken,
      body: { insertionId, ok: true, threadId: THREAD, messageId: `mcp:${insertionId}` },
    });
    expect(ack.status).toBe(409);
    const bad = await h.http({
      method: "POST",
      path: `/sessions/${code}/ack`,
      token: browserToken,
      body: { insertionId, ok: "yes" },
    });
    expect(bad.status).toBe(400);
  });

  it("passes on the browser's failure", async () => {
    const h = await harness();
    const { code, browserToken } = await h.open();
    const insertionId = randomUUID();
    const pending = h.insert({ connectionCode: code, insertionId, card: lineCard });
    await nextCard(h, code, browserToken);
    const ack = await h.http({
      method: "POST",
      path: `/sessions/${code}/ack`,
      token: browserToken,
      body: { insertionId, ok: false, error: "Thread is read-only" },
    });
    expect(ack.status).toBe(204);
    const result = await pending;
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("Thread is read-only");
  });

  it("allows one pending call per session", async () => {
    const h = await harness();
    const { code, browserToken } = await h.open();
    const first = randomUUID();
    const pending = h.insert({ connectionCode: code, insertionId: first, card: lineCard });
    await sleep(20);
    const second = await h.insert({
      connectionCode: code,
      insertionId: randomUUID(),
      card: lineCard,
    });
    expect(second.isError).toBe(true);
    expect(text(second)).toMatch(/already/i);
    await nextCard(h, code, browserToken);
    await h.http({
      method: "POST",
      path: `/sessions/${code}/ack`,
      token: browserToken,
      body: { insertionId: first, ok: true, threadId: THREAD, messageId: `mcp:${first}` },
    });
    expect((await pending).isError).toBeFalsy();
  });

  it("times out with delivery unknown and asks for a retry with the same insertionId", async () => {
    const h = await harness({ ackTimeoutMs: 150 });
    const { code, browserToken } = await h.open();
    const insertionId = randomUUID();
    const pending = h.insert({ connectionCode: code, insertionId, card: lineCard });
    await nextCard(h, code, browserToken);
    const result = await pending;
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/unknown/i);
    expect(text(result)).toContain(insertionId);
    // A late ack finds nothing pending.
    const late = await h.http({
      method: "POST",
      path: `/sessions/${code}/ack`,
      token: browserToken,
      body: { insertionId, ok: true, threadId: THREAD, messageId: `mcp:${insertionId}` },
    });
    expect(late.status).toBe(409);
  });

  it("fails the pending call when the browser revokes the session", async () => {
    const h = await harness();
    const { code, browserToken } = await h.open();
    const pending = h.insert({ connectionCode: code, insertionId: randomUUID(), card: lineCard });
    await nextCard(h, code, browserToken);
    const revoke = await h.http({
      method: "DELETE",
      path: `/sessions/${code}`,
      token: browserToken,
    });
    expect(revoke.status).toBe(204);
    const result = await pending;
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/disconnected|ended/i);
    expect(
      (await h.http({ method: "GET", path: `/sessions/${code}/next`, token: browserToken })).status,
    ).toBe(401);
    const after = await h.insert({
      connectionCode: code,
      insertionId: randomUUID(),
      card: lineCard,
    });
    expect(after.isError).toBe(true);
  });

  it("fails the pending call when the browser stops polling", async () => {
    const h = await harness({ idleMs: 100, ackTimeoutMs: 5000 });
    const { code } = await h.open();
    const started = Date.now();
    const result = await h.insert({
      connectionCode: code,
      insertionId: randomUUID(),
      card: lineCard,
    });
    expect(result.isError).toBe(true);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(text(result)).toMatch(/not delivered/i);
  });
});
