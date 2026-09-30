import type { Agent } from "@yaklabs/catalog/agent";
import {
  applyChunk,
  cancelReply,
  completeReply,
  startReply,
  type AgentMessage,
  type ReplyChunk,
} from "@yaklabs/catalog/reply";
import { describe, expect, it, vi } from "vitest";
import { beats, init, profit, sendAsk, startLoop } from "./agentLoop.harness";
import type { Notice } from "./protocol";

// A reply that shows its work: a check starts, a card and a finding land, the check settles
// with its outcome, and the work is summed up.
const work: ReplyChunk[] = [
  { kind: "step", step: { id: "orders", label: "Pull last week's orders", status: "running" } },
  { kind: "card", payload: { component: "BarChart", props: { title: "Profit by day" } } },
  { kind: "text", text: "Saturday leads", mark: "strong" },
  " the week.",
  {
    kind: "step",
    step: {
      id: "orders",
      label: "Pull last week's orders",
      status: "done",
      outcome: "412 orders, Sep 14–20",
      evidence: { rows: 412 },
    },
  },
  { kind: "summary", text: "Checked last week's orders" },
];

const failure: ReplyChunk = {
  kind: "failure",
  failure: { title: "Reply interrupted", detail: "The sales system stopped answering." },
};

// An agent that yields `chunks`, then ends, or with `hold`, waits until it is stopped.
function says(chunks: ReplyChunk[], hold = false): Agent {
  return {
    async *respond(_event, signal) {
      yield* chunks;
      if (!hold) return;
      await new Promise((resolve) => {
        signal.addEventListener("abort", resolve, { once: true });
      });
    },
  };
}

// The turn the catalog's fold builds from `chunks`, as the loop starts it for request r1.
const fold = (chunks: ReplyChunk[]): AgentMessage =>
  chunks.reduce((turn, chunk) => applyChunk(turn, chunk), startReply("r1", "10:03"));

// The chunks the loop forwarded, in order.
const forwarded = (notices: Notice[]): ReplyChunk[] =>
  notices.flatMap((notice) => (notice.kind === "chunk" ? [notice.chunk] : []));

// The thread's turns as `open` answers them: read back from SQLite through the protocol.
async function opened(run: (data: unknown) => Promise<void>, notices: Notice[]) {
  await run({ kind: "open", requestId: "o1", threadId: profit });
  const answer = notices.at(-1);
  if (answer?.kind !== "opened") throw new Error(`open answered ${answer?.kind}`);
  return answer.messages;
}

describe("the agent loop carries a reply's events", () => {
  it("forwards every chunk and keeps the turn its fold builds, complete", async () => {
    const { notices, run } = await startLoop(() => says(work));
    await run(init);
    await run(sendAsk);
    expect(beats(notices)).toEqual(["opening", "state", "chunk", "state", "done"]);
    expect(forwarded(notices)).toEqual(work);
    const turn = (await opened(run, notices)).at(-1);
    expect(turn).toEqual({ ...completeReply(fold(work)), id: "a2" });
    expect(turn).toMatchObject({
      text: "Saturday leads the week.",
      streaming: false,
      blocks: [{ kind: "card" }, { kind: "paragraph" }],
      work: {
        steps: [{ id: "orders", status: "done", outcome: "412 orders, Sep 14–20" }],
        summary: "Checked last week's orders",
      },
    });
    expect(turn).not.toHaveProperty("ended");
  });

  it("ends the turn at a failure, and reads nothing the agent says after it", async () => {
    const { notices, run } = await startLoop(() => says([...work, failure, "Never shown."]));
    await run(init);
    await run(sendAsk);
    expect(forwarded(notices)).toEqual([...work, failure]);
    const turn = (await opened(run, notices)).at(-1);
    expect(turn).toEqual({ ...fold([...work, failure]), id: "a2" });
    expect(turn).toMatchObject({
      streaming: false,
      ended: "interrupted",
      failure: { title: "Reply interrupted" },
    });
  });
});

describe("the agent loop settles a stopped or an empty reply", () => {
  it("keeps a stopped turn cancelled, with the check still running marked cancelled", async () => {
    const started: ReplyChunk = {
      kind: "step",
      step: { id: "costs", label: "Subtract the running costs", status: "running" },
    };
    const chunks = [...work, started];
    const { notices, run } = await startLoop(() => says(chunks, true));
    await run(init);
    const sending = run(sendAsk);
    await vi.waitFor(() => {
      expect(forwarded(notices)).toHaveLength(chunks.length);
    });
    await run({ kind: "abort", requestId: "r1" });
    await sending;
    const turn = (await opened(run, notices)).at(-1);
    expect(turn).toEqual({ ...cancelReply(fold(chunks)), id: "a2" });
    expect(turn).toMatchObject({
      ended: "cancelled",
      work: { steps: [{ status: "done" }, { id: "costs", status: "cancelled" }] },
    });
  });

  it("keeps no turn for a reply that showed nothing", async () => {
    const { notices, run } = await startLoop(() => says([{ kind: "activity", text: "Looking" }]));
    await run(init);
    await run(sendAsk);
    expect((await opened(run, notices)).map((message) => message.id)).toEqual(["u1", "a1", "u2"]);
  });
});
