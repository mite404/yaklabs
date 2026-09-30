import type { ThreadMessage } from "@yaklabs/catalog/thread";
import {
  threadIdSchema,
  type RuntimeState,
  type Source,
  type ThreadSummary,
  type Workspace,
} from "@yaklabs/runtime";
import { mainIdOf, seed, touched, withThread, type Edit, type Tomb } from "./edits";
import type { Script, Timed } from "./script";

/**
 * How far a script's replies have got: how many the scripted agent has started, in script
 * order, and which of those have settled (ended, failed or been stopped).
 */
export type Progress = { started: number; settled: ReadonlySet<number> };

/** Everything a demo runtime changes while it plays. */
export type Live = {
  state: RuntimeState;
  progress: Progress;
  transcripts: Map<string, ThreadMessage[]>;
  replying: Map<string, number>; // thread id → replies in flight, in the order they began
  queue: Timed[][]; // the script's replies still to answer with, in order
  tombs: Map<string, Tomb>; // deleted thread id → what its restore puts back
  listeners: Set<() => void>;
  stopAll: AbortController; // aborts every reply once the demo is disposed
  question?: string; // the last docked question's wording, for the answer that follows it
  minted: number; // instants minted so far
  made: number; // items created so far
};

/** The one place the demo's state changes: each change shows a new state and tells listeners. */
export type Store = {
  live: Live;
  /** A new instant, a second after the last, so what is made later sorts later. */
  stamp(): string;
  /** @throws Once the demo is disposed. */
  workspace(): Workspace;
  tell(): void;
  /** Applies one edit, or none, and shows the state it leaves as a new object. */
  commit(edit?: Edit): void;
  /** @throws For a thread the workspace lacks. */
  thread(id: string): ThreadSummary;
  /** @throws For a thread the workspace lacks. */
  turnsOf(id: string): ThreadMessage[];
  /** Sets a thread's turns, and its summary with them. */
  keep(id: string, turns: ThreadMessage[]): void;
  begin(id: string): void;
  end(id: string): void;
};

// Every instant starts from the demo's own morning, as a scenario's clock does (scenarios.ts).
const CLOCK = Date.parse("2026-09-29T09:00:00.000Z");

/** The closest honest source the schema has: a mock, never the device's data (ADR-096). */
export const SOURCE: Source = { kind: "scenario", name: "demo" };

/** Runs `work` as a verb's answer: its value resolves, and what it throws rejects. */
export function promised<T>(work: () => T): Promise<T> {
  return new Promise((resolve) => {
    resolve(work());
  });
}

/** A script's state before anything has played: its seeded workspace, and every reply to come. */
export function liveOf(script: Script): Live {
  const workspace = seed(script, new Date(CLOCK).toISOString());
  return {
    state: { kind: "ready", source: SOURCE, workspace, replying: [] },
    progress: { started: 0, settled: new Set() },
    transcripts: new Map([[mainIdOf(script), []]]),
    replying: new Map(),
    queue: script.beats.flatMap((beat) => (beat.kind === "reply" ? [beat.events] : [])),
    tombs: new Map(),
    listeners: new Set(),
    stopAll: new AbortController(),
    minted: 0,
    made: 0,
  };
}

// The store's reads: the workspace, a thread and its turns, each refusing what is not there.
function reads(live: Live): Pick<Store, "workspace" | "thread" | "turnsOf"> {
  const workspace = (): Workspace => {
    if (live.state.kind !== "ready") throw new Error("The scripted demo has stopped");
    return live.state.workspace;
  };
  const thread = (id: string): ThreadSummary => {
    const found = workspace().threads.find((each) => each.id === id);
    if (found === undefined) throw new Error(`There is no thread "${id}" in this demo`);
    return found;
  };
  const turnsOf = (id: string): ThreadMessage[] => {
    thread(id);
    return live.transcripts.get(id) ?? [];
  };
  return { workspace, thread, turnsOf };
}

/** The store over `live`: its reads, and the writes that each tell every listener. */
export function storeOf(live: Live): Store {
  const tell = () => {
    for (const listener of live.listeners) listener();
  };
  const commit = (edit: Edit = (ws) => ws) => {
    if (live.state.kind !== "ready") return;
    const replying = [...live.replying.keys()].map((id) => threadIdSchema.parse(id));
    live.state = { ...live.state, workspace: edit(live.state.workspace), replying };
    tell();
  };
  const stamp = () => new Date(CLOCK + ++live.minted * 1000).toISOString();
  const count = (id: string, by: number) => {
    const left = (live.replying.get(id) ?? 0) + by;
    if (left > 0) live.replying.set(id, left);
    else live.replying.delete(id);
    commit();
  };
  return {
    live,
    stamp,
    tell,
    commit,
    ...reads(live),
    keep: (id, turns) => {
      live.transcripts.set(id, turns);
      commit(withThread(id, touched(turns, stamp())));
    },
    begin: (id) => {
      count(id, 1);
    },
    end: (id) => {
      count(id, -1);
    },
  };
}
