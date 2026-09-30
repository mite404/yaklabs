import type { AgentEvent } from "@yaklabs/catalog/agent";
import type { ReplyChunk } from "@yaklabs/catalog/reply";
import type { ThreadMessage } from "@yaklabs/catalog/thread";
import { threadIdSchema, type RuntimeState, type Workspace } from "@yaklabs/runtime";
import { describe, expect, it } from "vitest";
import type { Clock } from "./clock";
import { createDemoRuntime, mainIdOf, type DemoRuntime } from "./runtime";
import { at, type Script } from "./script";
import { scriptFor } from "./scripts";

// A clock on which every wait is over at once.
const instant: Clock = {
  state: () => ({ rate: 1, paused: false }),
  subscribe: () => () => {},
  wait: () => Promise.resolve(),
  setRate: () => {},
  pause: () => {},
  resume: () => {},
};

const brief = scriptFor("brief");

// A thread id as the runtime's verbs take it.
const idOf = (value: string) => threadIdSchema.parse(value);

const ask = (text: string): AgentEvent => ({ kind: "message", text, attachments: [] });

const lastTurn = (turns: ThreadMessage[]) => turns.at(-1);

// The workspace of a ready state; the demo is always ready until disposed.
function workspaceOf(state: RuntimeState): Workspace {
  if (state.kind !== "ready") throw new Error(`The demo is ${state.kind}`);
  return state.workspace;
}

function replyingOf(state: RuntimeState): string[] {
  return state.kind === "ready" ? [...state.replying] : [];
}

// The words of text chunks, in order.
function wordsOf(chunks: ReplyChunk[]): string[] {
  return chunks.flatMap((chunk) =>
    typeof chunk !== "string" && chunk.kind === "text" ? [chunk.text] : [],
  );
}

// The chunks of the script's first reply, as written.
function firstReply(script: Script): ReplyChunk[] {
  const reply = script.beats.find((beat) => beat.kind === "reply");
  return reply?.kind === "reply" ? reply.events.map(({ chunk }) => chunk) : [];
}

// Whether a chunk is the step that starts the named child.
function starts(chunk: ReplyChunk, local: string): boolean {
  return typeof chunk !== "string" && chunk.kind === "step" && chunk.step.id === local;
}

// What stops a reply as the step that starts the named child goes by.
function stopAt(stop: AbortController, local: string): (chunk: ReplyChunk) => void {
  return (chunk) => {
    if (starts(chunk, local)) stop.abort();
  };
}

// Every chunk of one reply to the main thread, with `each` seeing them as they come.
async function drain(
  runtime: DemoRuntime,
  event: AgentEvent,
  signal = new AbortController().signal,
  each: (chunk: ReplyChunk) => void = () => {},
): Promise<ReplyChunk[]> {
  const chunks: ReplyChunk[] = [];
  for await (const chunk of runtime.agent(runtime.main).respond(event, signal)) {
    chunks.push(chunk);
    each(chunk);
  }
  return chunks;
}

// The `replying` lists a runtime shows, each once, in the order they came.
function recordReplying(runtime: DemoRuntime): string[][] {
  const seen: string[][] = [[]];
  runtime.subscribe(() => {
    const now = replyingOf(runtime.state());
    if (seen.at(-1)?.join() !== now.join()) seen.push(now);
  });
  return seen;
}

describe("the demo runtime's workspace", () => {
  it("opens on the script's project and main thread, empty and on its own tab", async () => {
    const runtime = createDemoRuntime(brief, instant);
    const state = runtime.state();
    const ws = workspaceOf(state);
    expect(state).toMatchObject({ source: { kind: "scenario", name: "demo" }, replying: [] });
    expect(ws.projects.map((each) => each.name)).toEqual(["Support desk"]);
    expect(ws.threads).toEqual([
      expect.objectContaining({ id: mainIdOf(brief), title: "Weekly brief", turnCount: 0 }),
    ]);
    expect(ws.shell).toMatchObject({ tabs: [mainIdOf(brief)] });
    expect(await runtime.open(runtime.main)).toEqual([]);
    await expect(runtime.open(idOf("nobody"))).rejects.toThrow(/no thread "nobody"/);
  });

  it("keeps the other verbs in memory, and refuses what it lacks", async () => {
    const runtime = createDemoRuntime(brief, instant);
    await runtime.rename({ kind: "thread", id: runtime.main }, "Monday brief");
    await runtime.mark(runtime.main, { pinned: true });
    expect(workspaceOf(runtime.state()).threads[0]).toMatchObject({ title: "Monday brief" });
    expect(workspaceOf(runtime.state()).threads[0]?.pinnedAt).not.toBeNull();
    await runtime.delete(runtime.main);
    expect(workspaceOf(runtime.state()).threads).toEqual([]);
    await runtime.restore(runtime.main);
    expect(workspaceOf(runtime.state()).threads).toHaveLength(1);
    await expect(runtime.rename({ kind: "thread", id: idOf("gone") }, "x")).rejects.toThrow(
      /no thread "gone"/,
    );
    await expect(runtime.restore(runtime.main)).rejects.toThrow(/no deleted thread/);
  });
});

describe("the demo runtime's scripted replies", () => {
  it("answers a request with the script's first reply, chunk by chunk and in order", async () => {
    const runtime = createDemoRuntime(brief, instant, { reduceMotion: () => false });
    const chunks = await drain(runtime, ask("Prepare the brief"));
    expect(chunks).toHaveLength(firstReply(brief).length);
    expect(wordsOf(chunks)).toEqual(wordsOf(firstReply(brief)));
    const turns = await runtime.open(runtime.main);
    expect(turns.map((turn) => turn.role)).toEqual(["user", "agent"]);
    expect(lastTurn(turns)).toMatchObject({ streaming: false, activity: undefined });
    expect(runtime.progress()).toEqual({ started: 1, settled: new Set([0]) });
  });

  it("lands a block's words together under reduced motion", async () => {
    const runtime = createDemoRuntime(brief, instant, { reduceMotion: () => true });
    const chunks = await drain(runtime, ask("Prepare the brief"));
    expect(wordsOf(chunks).length).toBeLessThan(40);
    expect(lastTurn(await runtime.open(runtime.main))?.text).toContain(
      "The backlog fell from 46 cases on Monday to 18 by Friday.",
    );
  });

  it("says the scenario is over once its replies are spent", async () => {
    const short: Script = {
      ...brief,
      beats: [
        { kind: "user", after: 0, text: "Hi" },
        { kind: "reply", events: [at(0, "Hello.")] },
      ],
    };
    const runtime = createDemoRuntime(short, instant);
    expect(await drain(runtime, ask("Hi"))).toEqual(["Hello."]);
    expect(await drain(runtime, ask("Again?"))).toEqual([
      "That is the end of this scripted scenario. Press Restart to play it again.",
    ]);
    expect(runtime.progress()).toEqual({ started: 2, settled: new Set([0, 1]) });
  });
});

describe("the demo runtime's children", () => {
  const [workload, issues] = [idOf("demo-brief-workload"), idOf("demo-brief-issues")];

  it("makes, runs and settles the children its steps name, replying as they work", async () => {
    const runtime = createDemoRuntime(brief, instant);
    const seen = recordReplying(runtime);
    await drain(runtime, ask("Prepare the brief"));
    const main = runtime.main;
    expect(seen).toEqual([
      [],
      [main],
      [main, workload],
      [main, workload, issues],
      [main, issues],
      [main],
      [],
    ]);
    const ws = workspaceOf(runtime.state());
    expect(ws.threads.filter((each) => each.place.kind === "child")).toEqual([
      expect.objectContaining({ id: workload, title: "Weekly workload", turnCount: 2 }),
      expect.objectContaining({ id: issues, title: "Open issues by category", turnCount: 2 }),
    ]);
    expect(ws.lanes[main]?.map((lane) => lane.id)).toEqual([`l-${workload}`, `l-${issues}`]);
    const turns = await runtime.open(workload);
    expect(turns[0]).toMatchObject({
      role: "user",
      text: "Count the open cases at the end of each weekday.",
    });
    expect(lastTurn(turns)).toMatchObject({
      text: "Backlog fell from 46 cases Monday to 18 by Friday.",
      streaming: false,
    });
  });

  it("cancels the children still running when the reply is stopped", async () => {
    const runtime = createDemoRuntime(brief, instant);
    const stop = new AbortController();
    await drain(runtime, ask("Prepare the brief"), stop.signal, stopAt(stop, "issues"));
    expect(replyingOf(runtime.state())).toEqual([]);
    expect(lastTurn(await runtime.open(workload))).toMatchObject({ ended: "cancelled" });
    expect(lastTurn(await runtime.open(issues))).toMatchObject({ ended: "cancelled" });
    expect(lastTurn(await runtime.open(runtime.main))).toMatchObject({ ended: "cancelled" });
    expect(runtime.progress().settled.has(0)).toBe(true);
  });
});

describe("the demo runtime's failed children", () => {
  it("notes a child that could not finish for the bell", async () => {
    const runtime = createDemoRuntime(scriptFor("interrupted"), instant);
    await drain(runtime, ask("Check the refunds"));
    expect(workspaceOf(runtime.state()).notifications.map((each) => each.text)).toEqual([
      "Refund audit: Order lookups could not finish.",
    ]);
    expect(lastTurn(await runtime.open(idOf("demo-interrupted-orders")))).toMatchObject({
      ended: "failed",
      failure: { title: "Could not finish" },
    });
    expect(lastTurn(await runtime.open(runtime.main))).toMatchObject({ ended: "interrupted" });
  });
});
