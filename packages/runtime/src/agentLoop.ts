import type { Agent } from "@yaklabs/catalog/agent";
import { createLabAgent } from "@yaklabs/catalog/labAgent";
import { z } from "zod";
import { blankConversation, fromSeed, withAgentReply, withUserTurn } from "./conversation";
import { createGatewayAgent } from "./gatewayAgent";
import {
  commandSchema,
  type AgentSpec,
  type Command,
  type Conversation,
  type Notice,
  type StorageKind,
} from "./protocol";
import type { ConversationStore } from "./store";

// An open store and where it keeps its data.
type OpenedStore = { store: ConversationStore; storage: StorageKind };
// What `init` sets up: the store, and which agent answers.
type Session = OpenedStore & { agent: AgentSpec };
// What an agent may need to answer one message.
type AgentContext = { store: ConversationStore; conversationId: string; accessToken?: string };
type CommandOf<K extends Command["kind"]> = Extract<Command, { kind: K }>;
type Queue = <T>(task: () => Promise<T>) => Promise<T>;

/** What the loop needs from where it runs: the worker entry gives the real ones, tests fakes. */
export type LoopHost = {
  /** Sends a notice to the page. */
  post: (notice: Notice) => void;
  /** Opens the store at `init`; it should fall back rather than fail. */
  openStore: () => Promise<OpenedStore>;
  /** The clock for turn times and `updatedAt`; defaults to the real one. */
  now?: () => Date;
  /** Builds the agent for one message; defaults to the lab stand-in or the gateway agent. */
  createAgent?: (spec: AgentSpec, context: AgentContext) => Agent;
};

// Everything the handlers share: the host, the write queue, the live replies and the session.
type Loop = {
  host: Required<LoopHost>;
  exclusive: Queue;
  replies: Map<string, AbortController>; // requestId → that reply's stop button
  session?: Promise<Session>;
};

const noop = (): void => {};

function defaultAgent(spec: AgentSpec, context: AgentContext): Agent {
  return spec.kind === "lab"
    ? createLabAgent()
    : createGatewayAgent({ baseUrl: spec.baseUrl, ...context });
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Runs one task at a time. Every read-modify-write of a conversation goes through it, so two
// replies finishing together cannot lose each other's turns.
function createQueue(): Queue {
  let tail: Promise<unknown> = Promise.resolve();
  return (task) => {
    const run = tail.then(task);
    tail = run.then(noop, noop);
    return run;
  };
}

function started(loop: Loop): Promise<Session> {
  return loop.session ?? Promise.reject(new Error("The runtime has not been started"));
}

// Reads, changes and saves one conversation as a single step.
function update(
  loop: Loop,
  store: ConversationStore,
  id: string,
  change: (conversation: Conversation) => Conversation,
): Promise<void> {
  return loop.exclusive(async () => {
    const current = (await store.open(id)) ?? blankConversation(id, loop.host.now());
    await store.save(change(current));
  });
}

async function init(loop: Loop, { agent }: CommandOf<"init">): Promise<void> {
  const opened = loop.session ?? loop.host.openStore(); // a second init keeps the store
  loop.session = opened.then(({ store, storage }) => ({ store, storage, agent }));
  loop.host.post({ kind: "ready", storage: (await loop.session).storage });
}

async function open(loop: Loop, { conversationId, seed }: CommandOf<"open">): Promise<void> {
  const { store } = await started(loop);
  const { now, post } = loop.host;
  const conversation = await loop.exclusive(async () => {
    const stored = await store.open(conversationId); // → Conversation | undefined
    if (stored !== undefined || seed === undefined) {
      return stored ?? blankConversation(conversationId, now());
    }
    const seeded = fromSeed(conversationId, seed, now());
    await store.save(seeded);
    return seeded;
  });
  post({ kind: "opened", conversation });
}

async function reply(loop: Loop, command: CommandOf<"send">, signal: AbortSignal): Promise<void> {
  const { requestId, conversationId, event, accessToken } = command;
  const { now, post, createAgent } = loop.host;
  const { store, agent: spec } = await started(loop);
  await update(loop, store, conversationId, (c) => withUserTurn(c, event, now()));
  const agent = createAgent(spec, { store, conversationId, accessToken });
  let text = "";
  for await (const piece of agent.respond(event, signal)) {
    if (signal.aborted) break;
    text += piece;
    post({ kind: "chunk", requestId, text: piece });
  }
  if (text.trim() !== "") {
    await update(loop, store, conversationId, (c) => withAgentReply(c, text, now()));
  }
  post({ kind: "done", requestId });
}

async function send(loop: Loop, command: CommandOf<"send">): Promise<void> {
  const controller = new AbortController();
  loop.replies.set(command.requestId, controller);
  try {
    await reply(loop, command, controller.signal);
  } catch (error) {
    loop.host.post({ kind: "failed", requestId: command.requestId, reason: reasonOf(error) });
  } finally {
    loop.replies.delete(command.requestId);
  }
}

async function list(loop: Loop): Promise<void> {
  const { store } = await started(loop);
  loop.host.post({ kind: "listed", conversations: await store.list() });
}

function handle(loop: Loop, command: Command): Promise<void> {
  switch (command.kind) {
    case "init":
      return init(loop, command);
    case "open":
      return open(loop, command);
    case "send":
      return send(loop, command);
    case "abort":
      loop.replies.get(command.requestId)?.abort();
      return Promise.resolve();
    case "list":
      return list(loop);
    default: {
      const unhandled: never = command;
      return unhandled;
    }
  }
}

/**
 * The loop that stands in for Kay's daemon (ADR-076): it owns the conversation store and the
 * agent, and talks to the page only through commands in and notices out, each checked on
 * arrival (ADR-086). The user's turn is saved before the agent runs, so it survives a failed
 * reply; the reply is saved once it ends, or when it is stopped, with what streamed so far.
 *
 * @returns A handler for each raw message from the page; it settles once the command is done.
 */
export function createAgentLoop(host: LoopHost): (data: unknown) => Promise<void> {
  const loop: Loop = {
    host: {
      ...host,
      now: host.now ?? (() => new Date()),
      createAgent: host.createAgent ?? defaultAgent,
    },
    exclusive: createQueue(),
    replies: new Map(),
  };

  return async (data) => {
    const parsed = commandSchema.safeParse(data); // → { success, data } | { success, error }
    if (!parsed.success) {
      host.post({ kind: "error", reason: `Unknown command: ${z.prettifyError(parsed.error)}` });
      return;
    }
    try {
      await handle(loop, parsed.data);
    } catch (error) {
      host.post({ kind: "error", reason: reasonOf(error) });
    }
  };
}
