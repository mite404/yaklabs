import type { AgentEvent } from "@yaklabs/catalog/agent";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { startRuntime, type Runtime, type RuntimeState } from "./runtime";
import { netProfitChoice } from "./testing";
import { lanesOf, locate, threadIdSchema, threadLane, type ThreadId } from "./workspace";

type Ready = Extract<RuntimeState, { kind: "ready" }>;

const profit = threadIdSchema.parse("profit");
// The user stepped the profit card to net profit, then asked about it.
const question = "Why is Saturday high?";
const ask: AgentEvent = { kind: "message", text: question, attachments: [netProfitChoice] };
// Turn times read like the seeds': "9:02", "10:02".
const clockTime: unknown = expect.stringMatching(/^\d{1,2}:\d{2}$/);

// A runtime on the device with the lab stand-in at its real pace, stopped when the test ends.
function startLab(): Runtime {
  const runtime = startRuntime({ agent: { kind: "lab" }, data: { kind: "device" } });
  onTestFinished(() => {
    runtime.dispose();
  });
  return runtime;
}

// The runtime's state once the worker's first `state` has arrived.
function ready(runtime: Runtime): Promise<Ready> {
  return vi.waitFor(
    () => {
      const state = runtime.state();
      if (state.kind !== "ready") throw new Error(`The runtime is still ${state.kind}`);
      return state;
    },
    { timeout: 10_000 },
  );
}

async function collect(pieces: AsyncIterable<string>): Promise<string[]> {
  const collected: string[] = [];
  for await (const piece of pieces) collected.push(piece);
  return collected;
}

// A thread's title as `state()` shows it; nothing before the workspace arrives.
function titleOf(state: RuntimeState, id: ThreadId): string | undefined {
  if (state.kind !== "ready") return undefined;
  return state.workspace.threads.find((thread) => thread.id === id)?.title;
}

// A fresh child of the profit thread, so a rerun in the same browser profile never collides.
async function newChild(runtime: Runtime): Promise<ThreadId> {
  const draft = "> Saturday leads\n\n";
  const id = await runtime.create({
    kind: "child",
    parentId: profit,
    at: 0,
    title: "Saturday",
    draft,
  });
  return threadIdSchema.parse(id);
}

describe("the runtime in a Web Worker keeps threads on the device", () => {
  it("starts from OPFS with the profit thread, and lists a new child before create settles", async () => {
    const runtime = startLab();
    const state = await ready(runtime);
    expect(state.source).toEqual({ kind: "device", storage: "opfs" });
    expect(locate(state.workspace, profit)).toEqual({ main: profit, focus: null });
    const id = await newChild(runtime);
    const { workspace } = await ready(runtime);
    expect(locate(workspace, id)).toEqual({ main: profit, focus: id });
    expect(lanesOf(workspace, profit).at(0)).toEqual(threadLane(id));
  }, 20_000);

  it("streams a reply about the card view and keeps the thread across workers", async () => {
    const first = startLab();
    await ready(first);
    const id = await newChild(first);
    const reply = (await collect(first.agent(id).respond(ask, new AbortController().signal))).join(
      "",
    );
    expect(reply).toContain("Net profit");
    const kept = await first.open(id);
    expect(kept).toEqual([
      { id: "u1", role: "user", text: question, time: clockTime, attachments: [netProfitChoice] },
      { id: "a1", role: "agent", text: reply, time: clockTime },
    ]);
    first.dispose();

    const second = startLab();
    const { workspace } = await ready(second);
    expect(await second.open(id)).toEqual(kept);
    expect(workspace.threads.find((thread) => thread.id === id)?.draft).toBe("");
  }, 20_000);

  it("stops a reply when the page aborts it", async () => {
    const runtime = startLab();
    await ready(runtime);
    const id = await newChild(runtime);
    const controller = new AbortController();
    const pieces: string[] = [];
    for await (const piece of runtime.agent(id).respond(ask, controller.signal)) {
      pieces.push(piece);
      controller.abort();
    }
    expect(pieces).toHaveLength(1);
  }, 20_000);
});

describe("the runtime shows the page's edits at once", () => {
  it("shows a rename before the worker answers, and keeps it across workers", async () => {
    const first = startLab();
    await ready(first);
    const id = await newChild(first);
    const renaming = first.rename({ kind: "thread", id }, "Weekend margins");
    expect(titleOf(first.state(), id)).toBe("Weekend margins");
    await renaming;
    first.dispose();

    const second = startLab();
    expect(titleOf(await ready(second), id)).toBe("Weekend margins");
  }, 20_000);

  it("rolls a refused arrange back and says why", async () => {
    const runtime = startLab();
    const before = lanesOf((await ready(runtime)).workspace, profit);
    const stranger = threadLane(threadIdSchema.parse("stranger"));
    const arranging = runtime.arrange(profit, [stranger]);
    expect(lanesOf((await ready(runtime)).workspace, profit)).toEqual([stranger]);
    await expect(arranging).rejects.toThrow("a thread lane on its own");
    expect(lanesOf((await ready(runtime)).workspace, profit)).toEqual(before);
  }, 20_000);

  it("keeps the page's shell across workers", async () => {
    const first = startLab();
    await ready(first);
    const shell = { version: 1, tabs: ["profit"], nonce: crypto.randomUUID() };
    await first.saveShell(shell);
    first.dispose();
    const second = startLab();
    expect((await ready(second)).workspace.shell).toEqual(shell);
  }, 20_000);
});

describe("the runtime falls back and breaks down plainly", () => {
  it("falls back to memory in a second worker while the first holds the database", async () => {
    const first = startLab();
    expect((await ready(first)).source).toEqual({ kind: "device", storage: "opfs" });
    const second = startLab(); // a second tab, say
    expect((await ready(second)).source).toEqual({ kind: "device", storage: "memory" });
  }, 20_000);

  it("fails what is waiting when it is stopped, and every call after", async () => {
    const runtime = startLab();
    await ready(runtime);
    const opening = runtime.open(profit);
    runtime.dispose();
    await expect(opening).rejects.toThrow("The runtime was stopped");
    await expect(runtime.open(profit)).rejects.toThrow("The runtime was stopped");
    expect(runtime.state()).toEqual({
      kind: "broken",
      source: { kind: "device", storage: "opfs" },
      reason: "The runtime was stopped",
    });
  }, 20_000);
});
