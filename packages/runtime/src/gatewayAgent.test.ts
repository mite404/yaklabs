import type { Agent, AgentEvent } from "@yaklabs/catalog/agent";
import { gatewayRequestSchema, type GatewayRequest } from "gateway/contract";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { describe, expect, it } from "vitest";
import { createGatewayAgent } from "./gatewayAgent";
import type { Conversation } from "./protocol";
import { createMemoryStore } from "./store";
import { netProfitChoice, profitThread } from "./testing";

// What the fake gateway saw, for the assertions.
type Seen = { request?: GatewayRequest; authorization?: string };
// How the fake gateway answers: a streamed body, or a refusal with a status.
type Reply =
  | { kind: "stream"; body: () => ReadableStream<Uint8Array> }
  | { kind: "refuse"; status: 401 };

const question = "Why is Saturday high?";
const ask: AgentEvent = { kind: "message", text: question, attachments: [netProfitChoice] };

// The thread as the worker leaves it before the agent runs: the user's turn already saved.
const saved: Conversation = {
  id: "demo",
  title: profitThread.title,
  updatedAt: "2026-09-26T10:03:00.000Z",
  messages: [
    ...profitThread.messages,
    { id: "u2", role: "user", text: question, time: "10:03", attachments: [netProfitChoice] },
  ],
};

const encoder = new TextEncoder();

// The events the SDK's `toReadableStream()` writes for a text reply, one JSON per line.
function replyEvents(pieces: string[]): unknown[] {
  const message = {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-test",
    content: [],
    stop_reason: null,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 0 },
  };
  const deltas = pieces.map((text) => ({
    type: "content_block_delta",
    index: 0,
    delta: { type: "text_delta", text },
  }));
  return [
    { type: "message_start", message },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    ...deltas,
    { type: "content_block_stop", index: 0 },
    {
      type: "message_delta",
      delta: { stop_reason: "end_turn", stop_sequence: null },
      usage: { output_tokens: pieces.length },
    },
    { type: "message_stop" },
  ];
}

// A body carrying `events`; `open` leaves it hanging, like a gateway still sending.
function ndjson(events: unknown[], { open = false } = {}): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      if (!open) controller.close();
    },
  });
}

// The gateway's route as the contract fixes it, answering with `reply`.
function fakeGateway(reply: Reply, seen: Seen): typeof fetch {
  const app = new Hono().post(
    "/api/messages",
    validator("json", (value, c) => {
      const parsed = gatewayRequestSchema.safeParse(value);
      return parsed.success ? parsed.data : c.json({ error: "invalid request" }, 400);
    }),
    (c) => {
      seen.request = c.req.valid("json");
      seen.authorization = c.req.header("authorization");
      return reply.kind === "stream"
        ? new Response(reply.body())
        : c.json({ error: "token expired for ethan@example.com" }, reply.status);
    },
  );
  return (input, init) => Promise.resolve(app.request(input, init));
}

// An agent on the saved thread, talking to a fake gateway that answers with `reply`.
async function agentFor(reply: Reply, seen: Seen = {}, accessToken?: string): Promise<Agent> {
  const store = createMemoryStore();
  await store.save(saved);
  const fetch = fakeGateway(reply, seen);
  return createGatewayAgent({
    baseUrl: "http://gateway.test",
    accessToken,
    store,
    conversationId: "demo",
    fetch,
  });
}

async function collect(pieces: AsyncIterable<string>): Promise<string[]> {
  const collected: string[] = [];
  for await (const piece of pieces) collected.push(piece);
  return collected;
}

describe("createGatewayAgent streams", () => {
  it("yields the model's reply as text pieces", async () => {
    const pieces = ["Net profit ", "peaks on Saturday ", "at $5,900."];
    const agent = await agentFor({ kind: "stream", body: () => ndjson(replyEvents(pieces)) });
    expect(await collect(agent.respond(ask, new AbortController().signal))).toEqual(pieces);
  });

  it("stops when the signal aborts, even while the gateway is still sending", async () => {
    const events = replyEvents(["Net ", "profit"]).slice(0, 3);
    const agent = await agentFor({ kind: "stream", body: () => ndjson(events, { open: true }) });
    const controller = new AbortController();
    const pieces: string[] = [];
    for await (const piece of agent.respond(ask, controller.signal)) {
      pieces.push(piece);
      controller.abort();
    }
    expect(pieces).toEqual(["Net "]);
  });
});

describe("createGatewayAgent asks", () => {
  it("sends the token and the thread, with the user's turn once and its card view last", async () => {
    const seen: Seen = {};
    const reply: Reply = { kind: "stream", body: () => ndjson(replyEvents(["Ok."])) };
    const agent = await agentFor(reply, seen, "token-1");
    await collect(agent.respond(ask, new AbortController().signal));
    expect(seen.authorization).toBe("Bearer token-1");
    expect(seen.request?.messages.map((turn) => turn.role)).toEqual(["user", "assistant", "user"]);
    expect(seen.request?.messages.at(-1)?.content).toBe(
      `${question}\n[Card view: Net profit · Sep 14–20]`,
    );
  });

  it("names the status of a refusal and never its body", async () => {
    const agent = await agentFor({ kind: "refuse", status: 401 });
    const reply = collect(agent.respond(ask, new AbortController().signal));
    await expect(reply).rejects.toThrow(/^The gateway replied 401$/);
  });

  it("refuses a conversation it cannot find", async () => {
    const agent = createGatewayAgent({
      baseUrl: "http://gateway.test",
      store: createMemoryStore(),
      conversationId: "missing",
    });
    await expect(collect(agent.respond(ask, new AbortController().signal))).rejects.toThrow(
      "No conversation missing",
    );
  });
});
