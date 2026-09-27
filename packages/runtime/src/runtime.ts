import type { Agent } from "@yaklabs/catalog/agent";
import type { ThreadMessage } from "@yaklabs/catalog/thread";
import { z } from "zod";
import {
  commandSchema,
  noticeSchema,
  type AgentSpec,
  type Command,
  type NewItem,
  type Notice,
  type RenameTarget,
  type RuntimeData,
  type Source,
} from "./protocol";
import { arranged, renamed, withShell, type Edit } from "./edits";
import { createInbox } from "./inbox";
import { untilAborted } from "./untilAborted";
import {
  lanesOf,
  type Lane,
  type LaneId,
  type ShellState,
  type ThreadId,
  type Workspace,
} from "./workspace";

/** How the page reaches the signed-in user's token, e.g. AuthKit's `getAccessToken` (ADR-084). */
export type Session = { getAccessToken(): Promise<string> };

/**
 * What the page sees of the worker. `starting` learns its source from the worker's `opening`,
 * so a start that hangs still says where its data would come from; `held` waits while another
 * tab has the device's database (ADR-116); `broken` is for good.
 */
export type RuntimeState =
  | { kind: "starting"; source: Source | null }
  | { kind: "held"; source: null }
  | { kind: "ready"; source: Source; workspace: Workspace; replying: ThreadId[] }
  | { kind: "broken"; source: Source | null; reason: string };

/** What the page starts the runtime with: which agent answers, and which data to open. */
export type RuntimeConfig = { agent: AgentSpec; data: RuntimeData };

/** The page's only door to the worker: one observable state, and the verbs that change it. */
export type Runtime = {
  /** Calls `listener` after every change to `state()`; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** The current state; the same object until something changes (useSyncExternalStore). */
  state(): RuntimeState;
  /** One thread's turns. @throws When the thread is unknown, or the runtime is broken. */
  open(id: ThreadId): Promise<ThreadMessage[]>;
  /**
   * Makes a project, a main thread or a child with its lane, and resolves to the new id once
   * `state()` already lists it.
   * @throws When the worker refuses it (say, an unknown parent), or the runtime is broken.
   */
  create(item: NewItem): Promise<string>;
  /** Renames in `state()` at once, then in the worker; a refusal rolls it back and throws. */
  rename(target: RenameTarget, name: string): Promise<void>;
  /**
   * Sets a main thread's lanes in `state()` at once, then in the worker, like `rename`. A lane
   * `state()` did not show yet (a child whose create is still in flight) stays beside its
   * neighbour rather than being dropped.
   */
  arrange(mainId: ThreadId, lanes: Lane[]): Promise<void>;
  /** Keeps the page's shell whole, in `state()` at once, then in the worker, like `rename`. */
  saveShell(shell: ShellState): Promise<void>;
  /** The thread's `Agent` (ADR-041); replies stream from the worker. */
  agent(id: ThreadId, session?: Session): Agent;
  /** Stops the worker; everything still waiting fails, and the state is broken. */
  dispose(): void;
};

// A notice that answers one request, and what a request settles with.
type Answer = Extract<Notice, { requestId: string }>;
type Settled = Exclude<Answer, { kind: "failed" | "chunk" }>;
type Sink = (answer: Answer) => void;
type Post = (command: Command) => void;
// A command the page waits on for one answer.
type Asked = Exclude<Command, { kind: "init" | "send" | "abort" }>;

// The handle's own state: the worker's last word, the edits still waiting for their answer, who
// waits for which request, and what `state()` shows (the confirmed state with the edits on top).
type Handle = {
  confirmed: RuntimeState;
  edits: Map<string, Edit>; // requestId → an edit shown until its answer
  sinks: Map<string, Sink>; // requestId → whoever waits for its answers
  shown: RuntimeState;
  listeners: Set<() => void>;
};

// The lane ids the page sees on a main now: what its `arrange` was edited from.
function baseOf(state: RuntimeState, mainId: ThreadId): LaneId[] {
  return state.kind === "ready" ? lanesOf(state.workspace, mainId).map((lane) => lane.id) : [];
}

function createHandle(): Handle {
  const starting: RuntimeState = { kind: "starting", source: null };
  return {
    confirmed: starting,
    edits: new Map(),
    sinks: new Map(),
    shown: starting,
    listeners: new Set(),
  };
}

const newId = () => crypto.randomUUID();

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

// Recomputes what `state()` shows and tells every listener.
function show(handle: Handle): void {
  const { confirmed, edits } = handle;
  handle.shown =
    confirmed.kind === "ready" && edits.size > 0
      ? {
          ...confirmed,
          workspace: [...edits.values()].reduce((ws, edit) => edit(ws), confirmed.workspace),
        }
      : confirmed;
  for (const listener of handle.listeners) listener();
}

// Breaks the runtime for good: every request still waiting fails with `reason`.
function breakDown(handle: Handle, reason: string): void {
  if (handle.confirmed.kind === "broken") return;
  handle.confirmed = { kind: "broken", source: handle.confirmed.source, reason };
  handle.edits.clear();
  for (const [requestId, sink] of handle.sinks) sink({ kind: "failed", requestId, reason });
  handle.sinks.clear();
  show(handle);
}

// An answer goes to whoever waits for its request; the rest change the runtime's state.
function receive(handle: Handle, notice: Notice): void {
  if (handle.confirmed.kind === "broken") return;
  if ("requestId" in notice) {
    handle.sinks.get(notice.requestId)?.(notice);
    return;
  }
  switch (notice.kind) {
    case "held":
      handle.confirmed = { kind: "held", source: null };
      show(handle);
      return;
    case "opening":
      handle.confirmed = { kind: "starting", source: notice.source };
      show(handle);
      return;
    case "state": {
      const { source, workspace, replying } = notice;
      handle.confirmed = { kind: "ready", source, workspace, replying };
      show(handle);
      return;
    }
    case "broken":
      breakDown(handle, notice.reason);
      return;
    default: {
      const unhandled: never = notice;
      return unhandled;
    }
  }
}

// Sends one command and settles with its answer. The edit, if any, shows at once and goes when
// the answer comes: by then a `state` holding the write has arrived, or the write was refused.
function ask(handle: Handle, post: Post, command: Asked, edit?: Edit): Promise<Settled> {
  if (handle.confirmed.kind === "broken") return Promise.reject(new Error(handle.confirmed.reason));
  const { requestId } = command;
  try {
    post(command); // throws when the command fails its own check
  } catch (error) {
    return Promise.reject(asError(error));
  }
  return new Promise((resolve, reject) => {
    handle.sinks.set(requestId, (answer) => {
      if (answer.kind === "chunk") return;
      handle.sinks.delete(requestId);
      if (handle.edits.delete(requestId)) show(handle);
      if (answer.kind === "failed") reject(new Error(answer.reason));
      else resolve(answer);
    });
    if (edit !== undefined) {
      handle.edits.set(requestId, edit);
      show(handle);
    }
  });
}

function unexpected(answer: Settled): Error {
  return new Error(`The runtime worker answered ${answer.requestId} with ${answer.kind}`);
}

function agentFor(handle: Handle, post: Post, threadId: ThreadId, session?: Session): Agent {
  return {
    async *respond(event, signal) {
      const accessToken = await session?.getAccessToken(); // → string | undefined
      if (signal.aborted) return;
      // After the wait for the token: a runtime that broke meanwhile answers nothing more.
      if (handle.confirmed.kind === "broken") throw new Error(handle.confirmed.reason);
      const requestId = newId();
      const inbox = createInbox<Answer>(); // a reply's answers, pushed by `receive`
      post({ kind: "send", requestId, threadId, event, accessToken }); // throws if malformed
      handle.sinks.set(requestId, inbox.push);
      let finished = false;
      try {
        for await (const answer of untilAborted(inbox, signal)) {
          if (answer.kind === "chunk") {
            yield answer.text;
            continue;
          }
          finished = true;
          if (answer.kind === "failed") throw new Error(answer.reason);
          return;
        }
      } finally {
        handle.sinks.delete(requestId);
        if (!finished) post({ kind: "abort", requestId });
      }
    },
  };
}

// Routes the worker's notices, and turns its failures into a broken runtime.
function listen(worker: Worker, handle: Handle): void {
  worker.addEventListener("message", (event) => {
    const parsed = noticeSchema.safeParse(event.data); // → { success, data } | { success, error }
    if (parsed.success) receive(handle, parsed.data);
    else
      breakDown(
        handle,
        `The runtime worker sent a malformed notice: ${z.prettifyError(parsed.error)}`,
      );
  });
  // A worker that fails to load fires a plain Event; one that throws fires an ErrorEvent.
  worker.addEventListener("error", (event: Event) => {
    const detail = event instanceof ErrorEvent ? event.message : "it could not start";
    breakDown(handle, `The runtime worker failed: ${detail}`);
  });
  worker.addEventListener("messageerror", () => {
    breakDown(handle, "The runtime worker sent a message the page could not read");
  });
}

/**
 * Starts the worker that stands in for Kay's daemon (ADR-076, ADR-083) and returns the page's
 * handle on it. The page and the worker talk only through messages, each checked on arrival
 * (ADR-086); a malformed notice or a crashed worker breaks the runtime and fails every call
 * still waiting.
 *
 * @throws When `config` fails the protocol's check.
 */
export function startRuntime(config: RuntimeConfig): Runtime {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const handle = createHandle();
  const post: Post = (command) => {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- workers have none
    worker.postMessage(commandSchema.parse(command)); // the worker checks again on arrival
  };
  listen(worker, handle);
  post({ kind: "init", agent: config.agent, data: config.data });

  return {
    subscribe: (listener) => {
      handle.listeners.add(listener);
      return () => {
        handle.listeners.delete(listener);
      };
    },
    state: () => handle.shown,
    open: async (threadId) => {
      const answer = await ask(handle, post, { kind: "open", requestId: newId(), threadId });
      if (answer.kind !== "opened") throw unexpected(answer);
      return answer.messages;
    },
    create: async (item) => {
      const answer = await ask(handle, post, { kind: "create", requestId: newId(), item });
      if (answer.kind !== "created") throw unexpected(answer);
      return answer.id;
    },
    rename: async (target, name) => {
      const command: Command = { kind: "rename", requestId: newId(), target, name };
      await ask(handle, post, command, renamed(target, name));
    },
    arrange: async (mainId, lanes) => {
      const base = baseOf(handle.shown, mainId);
      const command: Command = { kind: "arrange", requestId: newId(), mainId, lanes, base };
      await ask(handle, post, command, arranged(mainId, lanes, base));
    },
    saveShell: async (shell) => {
      const command: Command = { kind: "saveShell", requestId: newId(), shell };
      await ask(handle, post, command, withShell(shell));
    },
    agent: (threadId, session) => agentFor(handle, post, threadId, session),
    dispose: () => {
      worker.terminate();
      breakDown(handle, "The runtime was stopped");
    },
  };
}
