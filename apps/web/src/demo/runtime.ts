import type { Agent, AgentEvent } from "@yaklabs/catalog/agent";
import { labAgent } from "@yaklabs/catalog/labAgent";
import {
  applyChunk,
  cancelReply,
  completeReply,
  startReply,
  type AgentMessage,
  type ReplyChunk,
  type WorkStep,
} from "@yaklabs/catalog/reply";
import type { Runtime, ThreadId } from "@yaklabs/runtime";
import type { Clock } from "./clock";
import { addChild, childOf, mainIdOf, notified, type ChildOf } from "./edits";
import {
  childTurns,
  END_REPLY,
  openingTurns,
  play,
  TURN_TIME,
  userTurn,
  wordingOf,
} from "./replies";
import type { Script } from "./script";
import { liveOf, SOURCE, storeOf, type Progress, type Store } from "./store";
import { menuVerbs, workspaceVerbs } from "./verbs";

export { mainIdOf } from "./edits";

/** A runtime that plays a script: the app's `Runtime`, its main thread, and its progress. */
export type DemoRuntime = Runtime & {
  main: ThreadId;
  /** The same object until a reply starts or settles; `subscribe` hears both. */
  progress(): Progress;
};

/** What the runtime reads from the page; tests pass their own. */
export type DemoOptions = {
  /** Whether a reply's words land a block at a time rather than a word at a time. */
  reduceMotion?: () => boolean;
};

// What a scripted reply plays with.
type Stage = { store: Store; script: Script; clock: Clock; reduce: boolean };

// Whether the page asks for less motion; a page without a window never does.
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// A step of the main's work, applied to the child it names: made on first sight, running,
// then answered, failed or cancelled; a failure leaves a note for the bell.
function moveChild(store: Store, script: Script, step: WorkStep, child: ChildOf): void {
  if (!store.live.transcripts.has(child.id)) {
    const opening = openingTurns(child);
    store.live.transcripts.set(child.id, opening);
    store.commit(addChild(child, mainIdOf(script), opening, store.stamp()));
  }
  const wasRunning = store.live.replying.has(child.id);
  store.keep(child.id, childTurns(store.turnsOf(child.id), step));
  const settled = step.status !== "running" && step.status !== "pending";
  if (step.status === "running" && !wasRunning) store.begin(child.id);
  if (settled && wasRunning) store.end(child.id);
  if (step.status !== "failed") return;
  const at = store.stamp();
  const text = `${script.thread}: ${step.label} could not finish.`;
  store.commit(notified({ id: `note-${store.live.minted}`, threadId: child.id, text, at }));
}

// One reply's turn on a thread: the user's turn, then the agent's, kept as it streams and
// settled when it completes, fails or is stopped. `take` sees each chunk first.
async function* converse(
  store: Store,
  id: string,
  event: AgentEvent,
  chunks: (signal: AbortSignal) => AsyncIterable<ReplyChunk>,
  signal: AbortSignal,
  take: (chunk: ReplyChunk) => ReplyChunk = (chunk) => chunk,
): AsyncGenerator<ReplyChunk> {
  const { stopAll } = store.live;
  const stop = AbortSignal.any([signal, stopAll.signal]);
  const before = store.turnsOf(id);
  const asked = userTurn(event, `${id}-${before.length + 1}`, store.live.question);
  const at = before.length + asked.length; // → the reply's index in the turns
  let reply: AgentMessage = startReply(`${id}-${at + 1}`, TURN_TIME);
  const put = () => store.turnsOf(id).with(at, reply);
  store.keep(id, [...before, ...asked, reply]);
  store.begin(id);
  try {
    for await (const raw of chunks(stop)) {
      if (stop.aborted) break;
      const chunk = take(raw);
      reply = applyChunk(reply, chunk);
      store.live.transcripts.set(id, put());
      yield chunk;
    }
  } finally {
    if (stop.aborted) reply = cancelReply(reply);
    else if (reply.ended === undefined) reply = completeReply(reply);
    // A disposed demo keeps nothing more: its page is already gone.
    if (!stopAll.signal.aborted) {
      store.keep(id, put());
      store.end(id);
    }
  }
}

// What a scripted reply does with each chunk before it goes out: a docked question's wording
// is kept for the answer, and a step moves the child it names, under its workspace id.
function taker(stage: Stage, running: Map<string, { step: WorkStep; child: ChildOf }>) {
  return (chunk: ReplyChunk): ReplyChunk => {
    if (typeof chunk === "string") return chunk;
    if (chunk.kind === "question") stage.store.live.question = wordingOf(chunk.question);
    if (chunk.kind !== "step" || chunk.step.threadId === undefined) return chunk;
    const child = childOf(stage.script, chunk.step.threadId);
    const step = { ...chunk.step, threadId: child.id };
    moveChild(stage.store, stage.script, step, child);
    if (step.status === "running") running.set(child.id, { step, child });
    else running.delete(child.id);
    return { kind: "step", step };
  };
}

// The main's reply: the script's next, or the closing line once the script is spent. A stop
// cancels the children it still runs; either way the reply settles in the progress.
function scripted(stage: Stage, event: AgentEvent, signal: AbortSignal): AsyncIterable<ReplyChunk> {
  const { store, script, clock, reduce } = stage;
  const { live } = store;
  const ordinal = live.progress.started;
  const events = live.queue.shift() ?? END_REPLY;
  live.progress = { ...live.progress, started: ordinal + 1 };
  store.tell();
  const running = new Map<string, { step: WorkStep; child: ChildOf }>();
  const chunks = (stop: AbortSignal) => play(events, clock, stop, reduce);
  const stream = converse(store, mainIdOf(script), event, chunks, signal, taker(stage, running));
  return (async function* () {
    try {
      yield* stream;
    } finally {
      if (!live.stopAll.signal.aborted) {
        for (const each of running.values())
          moveChild(store, script, { ...each.step, status: "cancelled" }, each.child);
        live.progress = { ...live.progress, settled: new Set([...live.progress.settled, ordinal]) };
        store.tell();
      }
    }
  })();
}

/**
 * A `Runtime` that plays `script` in memory, with no worker and nothing kept or sent. Its main
 * thread answers each request with the script's next reply, on `clock`, and the steps of that
 * reply make, run and settle the child threads they name, each with its lane on the main's
 * canvas and a notification when one fails. Every other thread is answered by the lab stand-in.
 * The workspace's other verbs work on the workspace in memory.
 * @throws From the scripted reply, when a step names a child the script does not; the verbs
 * reject for a thread or project the workspace lacks, as the worker's do.
 */
export function createDemoRuntime(
  script: Script,
  clock: Clock,
  { reduceMotion = prefersReducedMotion }: DemoOptions = {},
): DemoRuntime {
  const main = mainIdOf(script);
  const store = storeOf(liveOf(script));
  const { live } = store;
  const agent = (id: ThreadId): Agent => ({
    respond: (event, signal) => {
      if (id === main)
        return scripted({ store, script, clock, reduce: reduceMotion() }, event, signal);
      store.thread(id);
      return converse(store, id, event, (stop) => labAgent.respond(event, stop), signal);
    },
  });
  return {
    main,
    progress: () => live.progress,
    subscribe: (listener) => {
      live.listeners.add(listener);
      return () => {
        live.listeners.delete(listener);
      };
    },
    state: () => live.state,
    ...workspaceVerbs(store, script),
    ...menuVerbs(store),
    agent,
    dispose: () => {
      live.stopAll.abort();
      live.state = { kind: "broken", source: SOURCE, reason: "The scripted demo was restarted" };
      store.tell();
    },
  };
}
