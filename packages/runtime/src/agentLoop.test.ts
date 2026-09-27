import type { Agent, AgentEvent } from "@yaklabs/catalog/agent";
import { createLabAgent } from "@yaklabs/catalog/labAgent";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { createAgentLoop, type LoopHost } from "./agentLoop";
import { fixedMint } from "./mint";
import type { Command, Notice } from "./protocol";
import { openSqliteStore } from "./sqliteStore";
import { ensureStarter, type Store } from "./store";
import { netProfitChoice } from "./testing";
import {
  lanesOf,
  projectIdSchema,
  threadIdSchema,
  threadLane,
  type ThreadId,
  type Workspace,
} from "./workspace";

// 10:03 UTC, the minute the user asks; the fixed mint writes turn times in UTC.
const asked = new Date("2026-09-26T10:03:00.000Z");
const profit = threadIdSchema.parse("profit");
const ask: AgentEvent = {
  kind: "message",
  text: "Why is Saturday high?",
  attachments: [netProfitChoice],
  files: [{ name: "till-roll.png", type: "image/png", size: 2048 }],
};

const init: Command = { kind: "init", agent: { kind: "lab" }, data: { kind: "device" } };
const openProfit: Command = { kind: "open", requestId: "r1", threadId: profit };
const sendAsk: Command = { kind: "send", requestId: "r1", threadId: profit, event: ask };
const child = (requestId: string, draft = ""): Command => ({
  kind: "create",
  requestId,
  item: { kind: "child", parentId: profit, at: 0, title: "Saturday", draft },
});

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

// A loop on a fresh memory store holding the starter's profit thread, with every notice it
// posts collected in order.
async function startLoop(createAgent: LoopHost["createAgent"] = quickLab) {
  const notices: Notice[] = [];
  const store = await openSqliteStore({ kind: "memory" });
  onTestFinished(() => {
    store.close();
  });
  const mint = fixedMint(asked);
  ensureStarter(store, mint.now().toISOString());
  const run = createAgentLoop({
    post: (notice) => {
      notices.push(notice);
    },
    open: () =>
      Promise.resolve({ store, source: { kind: "device", storage: "memory" }, mint, faults: {} }),
    createAgent,
  });
  return { notices, store, run };
}

// The notices' kinds, with a run of one kind folded into one beat: state, chunk, state, done.
function beats(notices: Notice[]): string[] {
  return notices
    .map((notice) => notice.kind)
    .filter((kind, i, kinds) => i === 0 || kinds[i - 1] !== kind);
}

function states(notices: Notice[]): Extract<Notice, { kind: "state" }>[] {
  return notices.flatMap((notice) => (notice.kind === "state" ? [notice] : []));
}

function lastWorkspace(notices: Notice[]): Workspace {
  const last = states(notices).at(-1);
  if (last === undefined) throw new Error("The loop pushed no state");
  return last.workspace;
}

const streamed = (notices: Notice[]): string =>
  notices.flatMap((notice) => (notice.kind === "chunk" ? [notice.text] : [])).join("");
const turnIds = (store: Store, id: ThreadId = profit) =>
  store.transcript(id)?.messages.map((message) => message.id);

describe("the agent loop starts", () => {
  it("says where its data lives, then pushes the workspace", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    expect(beats(notices)).toEqual(["opening", "state"]);
    expect(notices[0]).toEqual({ kind: "opening", source: { kind: "device", storage: "memory" } });
    expect(lastWorkspace(notices).threads.map((thread) => thread.id)).toEqual(["profit"]);
  });

  it("starts once, however often it is asked", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    await run(init);
    expect(beats(notices)).toEqual(["opening", "state"]);
  });

  it("breaks when its data cannot open, and fails every request after", async () => {
    const notices: Notice[] = [];
    const run = createAgentLoop({
      post: (notice) => {
        notices.push(notice);
      },
      open: () => Promise.reject(new Error("The disk is full")),
    });
    await run(init);
    await run(openProfit);
    expect(notices).toEqual([
      { kind: "broken", reason: "The disk is full" },
      { kind: "failed", requestId: "r1", reason: "The disk is full" },
    ]);
  });

  it("fails a request sent before init", async () => {
    const { notices, run } = await startLoop();
    await run(openProfit);
    const reason = "The runtime has not been started";
    expect(notices).toEqual([{ kind: "failed", requestId: "r1", reason }]);
  });

  it("fails a malformed command that names its request, and breaks on one that does not", async () => {
    const { notices, run } = await startLoop();
    await run({ kind: "shout", requestId: "r7" });
    await run({ kind: "shout" });
    expect(notices).toEqual([
      expect.objectContaining({ kind: "failed", requestId: "r7" }),
      { kind: "broken", reason: expect.stringContaining("Unknown command") as unknown },
    ]);
  });
});

describe("the agent loop answers each request on its own", () => {
  it("opens a thread's turns", async () => {
    const { notices, store, run } = await startLoop();
    await run(init);
    await run(openProfit);
    const messages = store.transcript(profit)?.messages;
    expect(notices.at(-1)).toEqual({ kind: "opened", requestId: "r1", messages });
  });

  it("fails one open without failing another", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    const missing = threadIdSchema.parse("missing");
    await Promise.all([
      run({ kind: "open", requestId: "bad", threadId: missing }),
      run({ kind: "open", requestId: "good", threadId: profit }),
    ]);
    const answers = notices.slice(2);
    expect(answers).toHaveLength(2);
    expect(answers).toContainEqual({
      kind: "failed",
      requestId: "bad",
      reason: "No thread missing",
    });
    expect(answers).toContainEqual(expect.objectContaining({ kind: "opened", requestId: "good" }));
  });
});

describe("the agent loop pushes the state before it answers a write", () => {
  it("lists a new child, its lane and its draft before naming its id", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    await run(child("r2", "> Saturday\n\n"));
    expect(beats(notices).slice(-2)).toEqual(["state", "created"]);
    const created = notices.at(-1);
    const workspace = lastWorkspace(notices);
    expect(created).toEqual({ kind: "created", requestId: "r2", id: "t-001" });
    expect(workspace.threads.find((thread) => thread.id === "t-001")).toMatchObject({
      place: { kind: "child", parentId: "profit" },
      draft: "> Saturday\n\n",
    });
    expect(lanesOf(workspace, profit).map((lane) => lane.id)).toEqual(["l-t-001"]);
  });

  it("names an untitled main thread, and answers rename, arrange and shell with done", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    await run({
      kind: "create",
      requestId: "r1",
      item: { kind: "main", projectId: projectIdSchema.parse("demo-store") },
    });
    await run({
      kind: "rename",
      requestId: "r2",
      target: { kind: "thread", id: profit },
      name: "Margins",
    });
    await run({ kind: "arrange", requestId: "r3", mainId: profit, lanes: [] });
    await run({ kind: "saveShell", requestId: "r4", shell: { version: 1 } });
    expect(beats(notices)).toEqual([
      "opening",
      "state",
      "created",
      "state",
      "done",
      "state",
      "done",
    ]);
    const workspace = lastWorkspace(notices);
    expect(workspace.threads.map((thread) => thread.title)).toEqual(["Margins", "New thread"]);
    expect(workspace.shell).toEqual({ version: 1 });
  });
});

describe("the agent loop pushes a state only when the workspace changes", () => {
  it("pushes no second state for a write that changes nothing", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    await run(child("r1"));
    const lanes = [threadLane(threadIdSchema.parse("t-001"))];
    await run({ kind: "arrange", requestId: "r2", mainId: profit, lanes });
    expect(beats(notices).slice(-2)).toEqual(["created", "done"]);
    expect(states(notices)).toHaveLength(2);
  });

  it("answers a refused write with failed and pushes nothing", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    const lanes = [threadLane(threadIdSchema.parse("stranger"))];
    await run({ kind: "arrange", requestId: "r1", mainId: profit, lanes });
    expect(beats(notices)).toEqual(["opening", "state", "failed"]);
  });
});

describe("the agent loop replies", () => {
  it("saves the user's turn and marks the thread replying before it streams", async () => {
    const { notices, store, run } = await startLoop();
    await run(init);
    await run(sendAsk);
    expect(beats(notices)).toEqual(["opening", "state", "chunk", "state", "done"]);
    expect(states(notices).map((state) => state.replying)).toEqual([[], ["profit"], []]);
    expect(streamed(notices)).toContain("Net profit · Sep 14–20");
    expect(store.transcript(profit)?.messages.slice(2)).toEqual([
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
  });

  it("spends a child's draft with its first turn", async () => {
    const { notices, store, run } = await startLoop();
    await run(init);
    await run(child("r1", "> Saturday\n\n"));
    const id = threadIdSchema.parse("t-001");
    await run({ ...sendAsk, requestId: "r2", threadId: id });
    expect(store.transcript(id)?.draft).toBe("");
    expect(lastWorkspace(notices).threads.find((thread) => thread.id === id)?.draft).toBe("");
  });

  it("adds no user turn for a rejected question, only the agent's plain-words ask", async () => {
    const { store, run } = await startLoop();
    await run(init);
    const rejected: AgentEvent = { kind: "question-rejected", reason: "too long", question: {} };
    await run({ ...sendAsk, event: rejected });
    expect(turnIds(store)).toEqual(["u1", "a1", "a2"]);
  });
});

describe("the agent loop recovers", () => {
  it("keeps the user's turn but no reply when the agent fails", async () => {
    const { notices, store, run } = await startLoop(() =>
      failsAfter(["Half a"], "The gateway replied 502"),
    );
    await run(init);
    await run(sendAsk);
    const failed = { kind: "failed", requestId: "r1", reason: "The gateway replied 502" };
    expect(notices.at(-1)).toEqual(failed);
    expect(states(notices).at(-1)?.replying).toEqual([]);
    expect(turnIds(store)).toEqual(["u1", "a1", "u2"]);
  });

  it("stops a reply on abort and keeps what streamed so far", async () => {
    const { notices, store, run } = await startLoop(() => waitsForAbort);
    await run(init);
    const sending = run(sendAsk);
    await vi.waitFor(() => {
      expect(streamed(notices)).toBe("Net profit ");
    });
    await run({ kind: "abort", requestId: "r1" });
    await sending;
    expect(notices.at(-1)).toEqual({ kind: "done", requestId: "r1" });
    expect(store.transcript(profit)?.messages.at(-1)?.text).toBe("Net profit ");
  });
});
