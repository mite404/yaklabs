import type { Agent } from "@yaklabs/catalog/agent";
import type { Thread } from "@yaklabs/catalog/thread";
import { z } from "zod";
import {
  commandSchema,
  noticeSchema,
  type AgentSpec,
  type Command,
  type Conversation,
  type ConversationSummary,
  type Notice,
  type StorageKind,
} from "./protocol";
import { untilAborted } from "./untilAborted";

/** How the page reaches the signed-in user's token, e.g. AuthKit's `getAccessToken` (ADR-084). */
export type Session = { getAccessToken(): Promise<string> };

/** The page's handle on the worker that runs the agent loop and keeps the conversations. */
export type Runtime = {
  /** Settles once the worker has opened its store; says whether it is on disk or in memory. */
  ready: Promise<{ storage: StorageKind }>;
  /** Reads a conversation; a new id starts from `seed` when given, else empty. */
  open(conversationId: string, seed?: Thread): Promise<Conversation>;
  /** Every stored conversation, newest first. */
  list(): Promise<ConversationSummary[]>;
  /** The thread's `Agent` for one conversation (ADR-041); replies stream from the worker. */
  agent(conversationId: string, session?: Session): Agent;
  /** Stops the worker; anything still waiting on it fails. */
  dispose(): void;
};

type ReplyNotice = Extract<Notice, { kind: "chunk" | "done" | "failed" }>;
// A reply's notices, pushed in by the router and pulled out by `respond`.
type Inbox = AsyncIterable<ReplyNotice> & { push(notice: ReplyNotice): void };
type Deferred<T> = Pick<PromiseWithResolvers<T>, "resolve" | "reject">;

// Everything waiting on the worker, so each notice finds its caller and a failure reaches all.
type Waiting = {
  ready: PromiseWithResolvers<{ storage: StorageKind }>;
  opens: Map<string, Deferred<Conversation>[]>; // conversationId → callers
  lists: Deferred<ConversationSummary[]>[]; // oldest first; the worker answers in order
  replies: Map<string, Inbox>; // requestId → its inbox
  broken?: Error;
};

function createInbox(): Inbox {
  const queued: ReplyNotice[] = [];
  const takers: ((notice: ReplyNotice) => void)[] = [];
  const next = (): Promise<IteratorResult<ReplyNotice>> => {
    const notice = queued.shift();
    if (notice !== undefined) return Promise.resolve({ done: false, value: notice });
    return new Promise((resolve) => {
      takers.push((value) => {
        resolve({ done: false, value });
      });
    });
  };
  return {
    push: (notice) => {
      const take = takers.shift();
      if (take === undefined) queued.push(notice);
      else take(notice);
    },
    [Symbol.asyncIterator]: () => ({ next }),
  };
}

// Fails everyone waiting. An `error` notice fails the calls it cannot be told apart from
// (opens, lists, start-up); a broken worker fails replies too, and every later call.
function failAll(waiting: Waiting, error: Error, { fatal }: { fatal: boolean }): void {
  waiting.ready.reject(error);
  for (const callers of waiting.opens.values()) for (const caller of callers) caller.reject(error);
  waiting.opens.clear();
  for (const caller of waiting.lists.splice(0)) caller.reject(error);
  if (!fatal) return;
  waiting.broken = error;
  for (const [requestId, inbox] of waiting.replies) {
    inbox.push({ kind: "failed", requestId, reason: error.message });
  }
}

// Hands the worker's answer to a call to whoever made it.
function deliverAnswer(waiting: Waiting, notice: Exclude<Notice, ReplyNotice>): void {
  switch (notice.kind) {
    case "ready":
      waiting.ready.resolve({ storage: notice.storage });
      return;
    case "opened": {
      const { id } = notice.conversation;
      for (const caller of waiting.opens.get(id) ?? []) caller.resolve(notice.conversation);
      waiting.opens.delete(id);
      return;
    }
    case "listed":
      waiting.lists.shift()?.resolve(notice.conversations);
      return;
    case "error":
      failAll(waiting, new Error(notice.reason), { fatal: false });
      return;
    default: {
      const unhandled: never = notice;
      return unhandled;
    }
  }
}

// Hands a notice to whoever waits for it: a reply's to its inbox, anything else to its caller.
function deliver(waiting: Waiting, notice: Notice): void {
  if ("requestId" in notice) waiting.replies.get(notice.requestId)?.push(notice);
  else deliverAnswer(waiting, notice);
}

// Sends a command and waits for the worker's answer. A command that fails its own check
// rejects here and never reaches the worker; a broken worker rejects at once.
function ask<T>(
  waiting: Waiting,
  post: (command: Command) => void,
  command: Command,
  register: (caller: Deferred<T>) => void,
): Promise<T> {
  if (waiting.broken !== undefined) return Promise.reject(waiting.broken);
  return new Promise<T>((resolve, reject) => {
    post(command);
    register({ resolve, reject });
  });
}

// Routes the worker's notices, and turns its failures into failures of everything waiting.
function listen(worker: Worker, waiting: Waiting): void {
  const breakDown = (reason: string) => {
    failAll(waiting, new Error(reason), { fatal: true });
  };
  worker.addEventListener("message", (event) => {
    const parsed = noticeSchema.safeParse(event.data); // → { success, data } | { success, error }
    if (parsed.success) deliver(waiting, parsed.data);
    else breakDown(`The runtime worker sent a malformed notice: ${z.prettifyError(parsed.error)}`);
  });
  // A worker that fails to load fires a plain Event; one that throws fires an ErrorEvent.
  worker.addEventListener("error", (event: Event) => {
    const detail = event instanceof ErrorEvent ? event.message : "it could not start";
    breakDown(`The runtime worker failed: ${detail}`);
  });
  worker.addEventListener("messageerror", () => {
    breakDown("The runtime worker sent a message the page could not read");
  });
}

function createAgentFor(
  waiting: Waiting,
  post: (command: Command) => void,
  conversationId: string,
  session?: Session,
): Agent {
  return {
    async *respond(event, signal) {
      if (waiting.broken !== undefined) throw waiting.broken;
      const accessToken = await session?.getAccessToken(); // → string | undefined
      if (signal.aborted) return;
      const requestId = crypto.randomUUID();
      const inbox = createInbox();
      post({ kind: "send", requestId, conversationId, event, accessToken }); // throws if malformed
      waiting.replies.set(requestId, inbox);
      let finished = false;
      try {
        for await (const notice of untilAborted(inbox, signal)) {
          if (notice.kind === "chunk") {
            yield notice.text;
            continue;
          }
          finished = true;
          if (notice.kind === "failed") throw new Error(notice.reason);
          return;
        }
      } finally {
        waiting.replies.delete(requestId);
        if (!finished) post({ kind: "abort", requestId });
      }
    },
  };
}

/**
 * Starts the worker that stands in for Kay's daemon (ADR-076, ADR-083) and returns the page's
 * handle on it. The page and the worker talk only through messages, each checked on arrival
 * (ADR-086); a malformed notice or a crashed worker fails everything waiting on it.
 *
 * @throws From `open`, `list` and `respond`: when a command fails its own check (say, an
 *   empty token), when the worker reports an error or breaks, or after `dispose`.
 */
export function startRuntime(config: { agent: AgentSpec }): Runtime {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const waiting: Waiting = {
    ready: Promise.withResolvers(),
    opens: new Map(),
    lists: [],
    replies: new Map(),
  };
  const post = (command: Command) => {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- workers have none
    worker.postMessage(commandSchema.parse(command)); // the worker checks again on arrival
  };
  listen(worker, waiting);
  // Every call below rejects with the same failure; this keeps an unwatched `ready` quiet.
  waiting.ready.promise.catch(() => {});
  post({ kind: "init", agent: config.agent });

  return {
    ready: waiting.ready.promise,
    open: (conversationId, seed) =>
      ask<Conversation>(waiting, post, { kind: "open", conversationId, seed }, (caller) => {
        waiting.opens.set(conversationId, [...(waiting.opens.get(conversationId) ?? []), caller]);
      }),
    list: () =>
      ask<ConversationSummary[]>(waiting, post, { kind: "list" }, (caller) => {
        waiting.lists.push(caller);
      }),
    agent: (conversationId, session) => createAgentFor(waiting, post, conversationId, session),
    dispose: () => {
      worker.terminate();
      failAll(waiting, new Error("The runtime was stopped"), { fatal: true });
    },
  };
}
