import type { AgentEvent } from "@yaklabs/catalog/agent";
import { card, paragraph, text, type Block } from "@yaklabs/catalog/prose";
import {
  cancelReply,
  startReply,
  type AgentMessage,
  type ReplyChunk,
  type WorkStep,
} from "@yaklabs/catalog/reply";
import type { ThreadMessage } from "@yaklabs/catalog/thread";
import type { Clock } from "./clock";
import type { ChildOf } from "./edits";
import type { Timed } from "./script";

/** A turn's time as the scenarios' mint writes it: the demo clock's, in UTC. */
export const TURN_TIME = "9:00";

/** What the main thread answers once the script's replies are spent. */
export const END_REPLY: Timed[] = [
  {
    after: 600,
    chunk: "That is the end of this scripted scenario. Press Restart to play it again.",
  },
];

// What a child's turn says while its parent's work on it runs.
const WORKING = "Working on it";

// Whether a chunk is words inside the block at hand.
function isInline(chunk: ReplyChunk): boolean {
  return typeof chunk === "string" || chunk.kind === "text" || chunk.kind === "link";
}

// Held words with one more: onto the last when both are plain or wear the same mark.
function held(words: ReplyChunk[], chunk: ReplyChunk): ReplyChunk[] {
  const last = words.at(-1);
  if (typeof last === "string" && typeof chunk === "string")
    return [...words.slice(0, -1), last + chunk];
  const sameRun =
    typeof last === "object" &&
    typeof chunk === "object" &&
    last.kind === "text" &&
    chunk.kind === "text" &&
    last.mark === chunk.mark;
  if (sameRun) return [...words.slice(0, -1), { ...last, text: last.text + chunk.text }];
  return [...words, chunk];
}

/**
 * A reply's chunks, each once its pause has passed on the clock. With `reduce`, a block's words
 * wait for the block's end and land together, so the page changes once per block rather than
 * once per word. A stop ends it where it is.
 */
export async function* play(
  events: Timed[],
  clock: Clock,
  signal: AbortSignal,
  reduce: boolean,
): AsyncGenerator<ReplyChunk> {
  let words: ReplyChunk[] = [];
  for (const { after, chunk } of events) {
    // oxlint-disable-next-line no-await-in-loop -- a stream waits between its chunks
    await clock.wait(after, signal);
    if (signal.aborted) return;
    if (reduce && isInline(chunk)) {
      words = held(words, chunk);
      continue;
    }
    yield* words;
    words = [];
    yield chunk;
  }
  yield* words;
}

/** The wording of a docked question, read only as far as this check proves. */
export function wordingOf(question: unknown): string | undefined {
  if (typeof question !== "object" || question === null || !("question" in question))
    return undefined;
  const wording = question.question; // → unknown
  return typeof wording === "string" ? wording : undefined;
}

/** The user's turn an event records: a message, or the answer to the docked question. */
export function userTurn(event: AgentEvent, id: string, question?: string): ThreadMessage[] {
  switch (event.kind) {
    case "message":
      return [{ id, role: "user", text: event.text, time: TURN_TIME }];
    case "answer":
      return [{ id, role: "user", text: event.text, time: TURN_TIME, question }];
    case "question-rejected":
      return [];
    default: {
      const unhandled: never = event;
      return unhandled;
    }
  }
}

/** A child's turns as its parent starts it: the request it was given, and its work under way. */
export function openingTurns(child: ChildOf): ThreadMessage[] {
  return [
    { id: `${child.local}-1`, role: "user", text: child.request, time: TURN_TIME },
    { ...startReply(`${child.local}-2`, TURN_TIME), activity: WORKING },
  ];
}

// What a finished step leaves as its child's answer: the outcome, then its evidence.
function outcomeTurn(turn: AgentMessage, step: WorkStep): AgentMessage {
  const outcome = step.outcome ?? "";
  const blocks: Block[] = [paragraph([text(outcome)])];
  if (step.evidence !== undefined) blocks.push(card(step.evidence));
  return { ...turn, text: outcome, blocks, streaming: false, activity: undefined };
}

// The child's last turn once its step settles: answered, failed or cancelled.
function settledTurn(turn: AgentMessage, step: WorkStep): AgentMessage {
  switch (step.status) {
    case "done":
      return outcomeTurn(turn, step);
    case "failed": {
      const failure = { title: "Could not finish", detail: step.outcome ?? "" };
      return { ...turn, streaming: false, activity: undefined, ended: "failed", failure };
    }
    case "cancelled":
      return cancelReply(turn);
    case "pending":
    case "running":
      return turn;
    default: {
      const unhandled: never = step.status;
      return unhandled;
    }
  }
}

/**
 * A child's turns once its step moves: a new attempt when it runs again after it ended, else
 * its last turn settled as the step says.
 */
export function childTurns(turns: ThreadMessage[], step: WorkStep): ThreadMessage[] {
  const last = turns.at(-1);
  if (last?.role !== "agent") return turns;
  if (step.status !== "running") return [...turns.slice(0, -1), settledTurn(last, step)];
  if (last.streaming === true) return turns;
  const attempt = startReply(`${step.id}-${turns.length + 1}`, TURN_TIME);
  return [...turns, { ...attempt, activity: WORKING }];
}
