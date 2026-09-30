import type { Agent, AgentEvent } from "@yaklabs/catalog/agent";
import { describe, expect, it, vi } from "vitest";
import {
  beats,
  child,
  init,
  lastWorkspace,
  profit,
  sendAsk,
  startLoop,
  states,
} from "./agentLoop.harness";
import type { Notice } from "./protocol";
import type { Store } from "./store";
import { netProfitChoice } from "./testing";
import { threadIdSchema, type ThreadId } from "./workspace";

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

// The words the loop forwarded; these agents yield nothing else.
const streamed = (notices: Notice[]): string =>
  notices
    .flatMap((notice) =>
      notice.kind === "chunk" && typeof notice.chunk === "string" ? [notice.chunk] : [],
    )
    .join("");
const turnIds = (store: Store, id: ThreadId = profit) =>
  store.transcript(id)?.messages.map((message) => message.id);

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
      { id: "a2", role: "agent", text: streamed(notices), time: "10:03", streaming: false },
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

  it("stops a reply on abort and keeps what streamed so far, marked cancelled", async () => {
    const { notices, store, run } = await startLoop(() => waitsForAbort);
    await run(init);
    const sending = run(sendAsk);
    await vi.waitFor(() => {
      expect(streamed(notices)).toBe("Net profit ");
    });
    await run({ kind: "abort", requestId: "r1" });
    await sending;
    expect(notices.at(-1)).toEqual({ kind: "done", requestId: "r1" });
    expect(store.transcript(profit)?.messages.at(-1)).toEqual({
      id: "a2",
      role: "agent",
      text: "Net profit ",
      time: "10:03",
      streaming: false,
      ended: "cancelled",
    });
  });
});
