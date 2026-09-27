import type { Agent, AgentEvent } from "@yaklabs/catalog/agent";
import { createLabAgent } from "@yaklabs/catalog/labAgent";
import { describe, expect, it, vi } from "vitest";
import { createAgentLoop, type LoopHost } from "./agentLoop";
import type { Command, Conversation, Notice } from "./protocol";
import { createMemoryStore } from "./store";
import { netProfitChoice, profitThread } from "./testing";

// 10:03 local time, the minute the user asks.
const asked = new Date(2026, 8, 26, 10, 3);
const ask: AgentEvent = {
  kind: "message",
  text: "Why is Saturday high?",
  attachments: [netProfitChoice],
  files: [{ name: "till-roll.png", type: "image/png", size: 2048 }],
};

const init: Command = { kind: "init", agent: { kind: "lab" } };
const openDemo: Command = { kind: "open", conversationId: "demo", seed: profitThread };
const sendAsk: Command = { kind: "send", requestId: "r1", conversationId: "demo", event: ask };

// The lab stand-in with no pauses, so a reply streams at once.
const quickLab = () => createLabAgent({ replyDelayMs: 0, wordMs: 0 });

// An agent that says `pieces` and then breaks down.
function failsAfter(pieces: string[], reason: string): Agent {
  return {
    async *respond() {
      yield* pieces;
      await Promise.reject(new Error(reason));
    },
  };
}

// An agent that says one thing, then waits until it is stopped.
const waitsForAbort: Agent = {
  async *respond(_event, signal) {
    yield "Net profit ";
    await new Promise((resolve) => {
      signal.addEventListener("abort", resolve, { once: true });
    });
  },
};

// A loop on a fresh memory store, with every notice it posts collected in order.
function startLoop(createAgent: LoopHost["createAgent"] = quickLab) {
  const notices: Notice[] = [];
  const store = createMemoryStore();
  const run = createAgentLoop({
    post: (notice) => {
      notices.push(notice);
    },
    openStore: () => Promise.resolve({ store, storage: "memory" }),
    now: () => asked,
    createAgent,
  });
  return { notices, store, run };
}

// What the page would read from the notices: the last opened conversation, the streamed text.
const lastOpened = (notices: Notice[]): Conversation | undefined =>
  notices.flatMap((notice) => (notice.kind === "opened" ? [notice.conversation] : [])).at(-1);
const streamed = (notices: Notice[]): string =>
  notices.flatMap((notice) => (notice.kind === "chunk" ? [notice.text] : [])).join("");
const ids = async (loop: ReturnType<typeof startLoop>) =>
  (await loop.store.open("demo"))?.messages.map((message) => message.id);

describe("the agent loop starts and opens", () => {
  it("says it is ready, and where it keeps conversations", async () => {
    const { notices, run } = startLoop();
    await run(init);
    expect(notices).toEqual([{ kind: "ready", storage: "memory" }]);
  });

  it("starts a new conversation from the seed and keeps it", async () => {
    const { notices, store, run } = startLoop();
    await run(init);
    await run(openDemo);
    expect(lastOpened(notices)?.messages).toEqual(profitThread.messages);
    expect((await store.list()).map((summary) => summary.id)).toEqual(["demo"]);
  });

  it("opens an unknown id with no seed as an empty conversation it does not save yet", async () => {
    const { notices, store, run } = startLoop();
    await run(init);
    await run({ kind: "open", conversationId: "fresh" });
    expect(lastOpened(notices)?.messages).toEqual([]);
    expect(await store.list()).toEqual([]);
  });

  it("answers a command it does not know with an error", async () => {
    const { notices, run } = startLoop();
    await run({ kind: "shout" });
    expect(notices.map((notice) => notice.kind)).toEqual(["error"]);
  });

  it("answers a command sent before init with an error", async () => {
    const { notices, run } = startLoop();
    await run({ kind: "list" });
    expect(notices).toEqual([{ kind: "error", reason: "The runtime has not been started" }]);
  });
});

describe("the agent loop replies", () => {
  it("streams the reply, then keeps the user's turn and the agent's", async () => {
    const { notices, store, run } = startLoop();
    await run(init);
    await run(openDemo);
    await run(sendAsk);
    expect(streamed(notices)).toContain("Net profit · Sep 14–20");
    expect(notices.at(-1)).toEqual({ kind: "done", requestId: "r1" });
    const saved = await store.open("demo");
    expect(saved?.messages.slice(2)).toEqual([
      {
        id: "u2",
        role: "user",
        text: "Why is Saturday high?",
        time: "10:03",
        attachments: [netProfitChoice],
        files: [{ id: "u2-f1", label: "till-roll.png" }],
      },
      { id: "a2", role: "agent", text: streamed(notices), time: "10:03" },
    ]);
    expect(saved?.updatedAt).toBe(asked.toISOString());
  });

  it("adds no user turn for a rejected question, only the agent's plain-words ask", async () => {
    const loop = startLoop();
    await loop.run(init);
    await loop.run(openDemo);
    const rejected: AgentEvent = { kind: "question-rejected", reason: "too long", question: {} };
    await loop.run({ ...sendAsk, event: rejected });
    expect(await ids(loop)).toEqual(["u1", "a1", "a2"]);
  });
});

describe("the agent loop recovers", () => {
  it("keeps the user's turn but no reply when the agent fails", async () => {
    const loop = startLoop(() => failsAfter(["Half a"], "The gateway replied 502"));
    await loop.run(init);
    await loop.run(openDemo);
    await loop.run(sendAsk);
    const failed = { kind: "failed", requestId: "r1", reason: "The gateway replied 502" };
    expect(loop.notices.at(-1)).toEqual(failed);
    expect(await ids(loop)).toEqual(["u1", "a1", "u2"]);
  });

  it("stops a reply on abort and keeps what streamed so far", async () => {
    const loop = startLoop(() => waitsForAbort);
    await loop.run(init);
    await loop.run(openDemo);
    const sending = loop.run(sendAsk);
    await vi.waitFor(() => {
      expect(streamed(loop.notices)).toBe("Net profit ");
    });
    await loop.run({ kind: "abort", requestId: "r1" });
    await sending;
    expect(loop.notices.at(-1)).toEqual({ kind: "done", requestId: "r1" });
    expect((await loop.store.open("demo"))?.messages.at(-1)?.text).toBe("Net profit ");
  });
});
