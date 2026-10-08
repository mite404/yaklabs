import type { Agent } from "@yaklabs/catalog/agent";
import type { Selection } from "@yaklabs/catalog/catalog";
import type { ThreadMessage } from "@yaklabs/catalog/thread";
import { describe, expect, it, vi } from "vitest";
import { child, init, lastWorkspace, profit, sendAsk, startLoop } from "./agentLoop.harness";
import type { Command, Notice } from "./protocol";
import { threadIdSchema, type ThreadId } from "./workspace";

// A card an external agent hands in over MCP, under an insertion id it minted once and retries.
const INSERTION = "0b6f4f1e-3c1a-4d2e-9f3b-6a1c2d3e4f50";
const comparison: Selection = {
  catalogVersion: "1",
  component: "BarChart",
  props: {
    title: "Closed cases by team",
    source: "Service desk export",
    unit: "cases",
    rows: [
      { label: "Support", value: 84 },
      { label: "Operations", value: 71 },
    ],
    variant: "comparison",
  },
};
// A trend with one known reading, which the catalog shows as exact values instead.
const sparse: Selection = {
  catalogVersion: "1",
  component: "LineChart",
  props: {
    title: "Refunds this week",
    source: "Till export",
    unit: "refunds",
    rows: [
      { label: "Mon", value: 4 },
      { label: "Tue", value: null },
    ],
    variant: "trend",
  },
};

const insert = (
  requestId: string,
  card: unknown = comparison,
  threadId: ThreadId = profit,
  insertionId = INSERTION,
) => ({ kind: "insertCard", requestId, threadId, insertionId, card });

// The thread's turns as `open` answers them: read back from SQLite through the protocol.
async function opened(
  run: (data: unknown) => Promise<void>,
  notices: Notice[],
  threadId: ThreadId = profit,
) {
  await run({ kind: "open", requestId: "o1", threadId });
  const answer = notices.at(-1);
  if (answer?.kind !== "opened") throw new Error(`open answered ${answer?.kind}`);
  return answer.messages;
}

// The reason the loop failed `requestId` with, as it answered last.
function refusal(notices: Notice[], requestId: string): string {
  const answer = notices.at(-1);
  if (answer?.kind !== "failed" || answer.requestId !== requestId)
    throw new Error(`${requestId} was answered ${answer?.kind}`);
  return answer.reason;
}

const idsOf = (messages: ThreadMessage[]) => messages.map((message) => message.id);

// An agent that waits until it is stopped, so its thread stays busy.
const holding: Agent = {
  async *respond(_event, signal) {
    yield "Counting";
    await new Promise((resolve) => {
      signal.addEventListener("abort", resolve, { once: true });
    });
  },
};

describe("the agent loop inserts an external agent's card", () => {
  it("saves one attributed agent turn, pushing the state before it answers done", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    await run(insert("x1"));
    expect(notices.slice(-2).map((notice) => notice.kind)).toEqual(["state", "done"]);
    expect(notices.at(-1)).toEqual({ kind: "done", requestId: "x1" });
    const messages = await opened(run, notices);
    expect(idsOf(messages)).toEqual(["u1", "a1", `mcp:${INSERTION}`]);
    const expected: ThreadMessage = {
      id: `mcp:${INSERTION}`,
      role: "agent",
      text: "Closed cases by team",
      time: "10:03",
      payload: comparison,
      external: { insertionId: INSERTION },
    };
    expect(messages.at(-1)).toEqual(expected);
  });

  it("keeps the thread's draft and turns as they were", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    await run(child("c1", "> Saturday\n\n"));
    const made = threadIdSchema.parse("t-001");
    await run(insert("x1", comparison, made));
    expect(notices.at(-1)).toEqual({ kind: "done", requestId: "x1" });
    const thread = lastWorkspace(notices).threads.find((each) => each.id === made);
    expect(thread?.draft).toBe("> Saturday\n\n");
    expect(idsOf(await opened(run, notices, made))).toEqual([`mcp:${INSERTION}`]);
  });

  it("saves the exact values the catalog falls back to, and says why", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    await run(insert("x1", sparse));
    const turn = (await opened(run, notices)).at(-1);
    expect(turn).toMatchObject({
      text: "Refunds this week · A trend needs at least two known observations. Showing the exact values instead.",
      payload: { component: "DataTable", props: { variant: "audit", title: "Refunds this week" } },
    });
  });

  it("saves an empty card as it came, so the thread can say there is nothing to show", async () => {
    const empty: Selection = { ...comparison, props: { ...comparison.props, rows: [] } };
    const { notices, run } = await startLoop();
    await run(init);
    await run(insert("x1", empty));
    expect((await opened(run, notices)).at(-1)).toMatchObject({
      text: "Closed cases by team",
      payload: empty,
    });
  });
});

describe("the agent loop takes an insertion once", () => {
  it("answers a retry of the same card done, with no second turn", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    await run(insert("x1"));
    await run(insert("x2"));
    expect(notices.at(-1)).toEqual({ kind: "done", requestId: "x2" });
    expect(idsOf(await opened(run, notices))).toEqual(["u1", "a1", `mcp:${INSERTION}`]);
  });

  it("refuses the same insertion id carrying a different card", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    await run(insert("x1"));
    const other = { ...comparison, props: { ...comparison.props, title: "Something else" } };
    await run(insert("x2", other));
    expect(refusal(notices, "x2")).toBe(`Insertion ${INSERTION} already holds a different card`);
    expect((await opened(run, notices)).at(-1)).toMatchObject({ text: "Closed cases by team" });
  });

  it("refuses the same insertion id aimed at another thread", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    await run(child("c1"));
    await run(insert("x1"));
    await run(insert("x2", comparison, threadIdSchema.parse("t-001")));
    expect(refusal(notices, "x2")).toBe(`Insertion ${INSERTION} already holds a different card`);
  });
});

describe("the agent loop refuses an insertion it cannot place", () => {
  it("refuses a card outside the catalog, or raw markup, and saves nothing", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    const markup = { ...comparison, props: { ...comparison.props, html: "<script>x</script>" } };
    await run(insert("x1", markup));
    expect(refusal(notices, "x1")).toMatch(/^Unknown command/);
    await run(insert("x2", { ...comparison, component: "PieChart" }));
    expect(refusal(notices, "x2")).toMatch(/^Unknown command/);
    expect(idsOf(await opened(run, notices))).toEqual(["u1", "a1"]);
  });

  it("refuses an insertion id that is not a UUID", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    await run(insert("x1", comparison, profit, "../../a1"));
    expect(refusal(notices, "x1")).toMatch(/^Unknown command/);
  });

  it("refuses an unknown thread and a deleted one", async () => {
    const { notices, run } = await startLoop();
    await run(init);
    await run(insert("x1", comparison, threadIdSchema.parse("missing")));
    expect(refusal(notices, "x1")).toBe("No thread missing");
    await run({ kind: "delete", requestId: "d1", threadId: profit });
    await run(insert("x2"));
    expect(refusal(notices, "x2")).toBe("No thread profit");
    await run({ kind: "restore", requestId: "d2", threadId: profit });
    expect(idsOf(await opened(run, notices))).toEqual(["u1", "a1"]);
  });

  it("refuses a scenario, which keeps nothing on the device", async () => {
    const scenario = { kind: "scenario", name: "demo" } as const;
    const { notices, run } = await startLoop(undefined, undefined, scenario);
    await run(init);
    await run(insert("x1"));
    expect(refusal(notices, "x1")).toBe("A scenario takes no external cards");
    expect(idsOf(await opened(run, notices))).toEqual(["u1", "a1"]);
  });

  it("refuses a thread whose reply is still in flight, rather than cut into it", async () => {
    const { notices, run } = await startLoop(() => holding);
    await run(init);
    const sending = run(sendAsk);
    await vi.waitFor(() => {
      expect(notices.some((notice) => notice.kind === "chunk")).toBe(true);
    });
    await run(insert("x1"));
    expect(refusal(notices, "x1")).toBe(
      "Thread profit is replying; insert the card once it is done",
    );
    const abort: Command = { kind: "abort", requestId: "r1" };
    await run(abort);
    await sending;
    expect(idsOf(await opened(run, notices))).toEqual(["u1", "a1", "u2", "a2"]);
  });
});
