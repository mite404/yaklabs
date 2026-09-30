import {
  PLAYGROUND_PROTOCOL,
  playgroundEventSchema,
  type PlaygroundEvent,
} from "@yaklabs/catalog/playground";
import type { Failure, ReplyChunk, WorkStep } from "@yaklabs/catalog/reply";
import { z } from "zod";
import { closeMarkdown, newEmitter, writeMarkdown, type MarkdownEmitter } from "./markdownEmitter";
import { COPY } from "./playgroundCopy";

// The gateway's stream (ADR-155, protocol 2) read as the reply seam's chunks (ADR-147). Pure:
// one event in, the chunks it yields out, so the same stream always builds the same turn.

// A `start` line of any protocol version, so a mismatch is named rather than unreadable.
const anyStartSchema = z.strictObject({
  type: z.literal("start"),
  seq: z.number().int().nonnegative(),
  v: z.number(),
});

/** One line of the gateway's stream: an event of this protocol, or a `start` of any version. */
export type Received = Exclude<PlaygroundEvent, { type: "start" }> | z.infer<typeof anyStartSchema>;

type EventOf<T extends Received["type"]> = Extract<Received, { type: T }>;

// The text block streaming in, under the gateway's blockId.
type Prose = { blockId: string; emitter: MarkdownEmitter };

/**
 * One reply's reading state. `next` is the seq the next event must carry: a lower one is a
 * replay, a higher one means a line was lost. `steps` are as last yielded, in the order they
 * first came, so a later event can update one whole and an early end can settle the rest.
 */
export type ReplyState = Readonly<{
  next: number;
  phase: "waiting" | "reading" | "over";
  steps: readonly WorkStep[];
  cards: readonly string[];
  prose: Prose | undefined;
}>;

/** What one event did: the next state, the chunks to yield, and `done` once reading stops. */
export type Receipt = { state: ReplyState; chunks: ReplyChunk[]; done?: true };

/** A reply before its first line. */
export const newReply: ReplyState = {
  next: 0,
  phase: "waiting",
  steps: [],
  cards: [],
  prose: undefined,
};

const noChunks = (state: ReplyState): Receipt => ({ state, chunks: [] });

const stepOf = (state: ReplyState, id: string): WorkStep | undefined =>
  state.steps.find((step) => step.id === id);

// Yields a step whole and keeps it, in place when it is known.
function putStep(state: ReplyState, step: WorkStep): Receipt {
  const known = stepOf(state, step.id) !== undefined;
  const steps = known
    ? state.steps.map((each) => (each.id === step.id ? step : each))
    : [...state.steps, step];
  return { state: { ...state, steps }, chunks: [{ kind: "step", step }] };
}

// A step moved on by an event, keeping what an earlier event said of it. A step the gateway
// never announced takes its id as its label.
function moveStep(state: ReplyState, id: string, change: Partial<WorkStep>): Receipt {
  const known = stepOf(state, id);
  return putStep(state, { id, label: id, status: "running", ...known, ...change });
}

// The open text block closed: the rest of its words.
function closeProse(state: ReplyState): Receipt {
  if (state.prose === undefined) return noChunks(state);
  return { state: { ...state, prose: undefined }, chunks: closeMarkdown(state.prose.emitter) };
}

// A delta of the open block, or of a new block, which closes the one before it.
function onText(state: ReplyState, event: EventOf<"text">): Receipt {
  const same = state.prose?.blockId === event.blockId ? state.prose : undefined;
  const closed = same === undefined ? closeProse(state) : noChunks(state);
  const written = writeMarkdown(same?.emitter ?? newEmitter, event.delta); // → Emitted
  const prose: Prose = { blockId: event.blockId, emitter: written.emitter };
  return { state: { ...closed.state, prose }, chunks: [...closed.chunks, ...written.chunks] };
}

// TODO(U3): yield `card {id: cardId, payload}` so a repeated cardId replaces the earlier card
// in place, and drop the `cardAgain` line. Until then a repeat is appended and the log says
// the earlier card stands.
function showCard(state: ReplyState, event: EventOf<"card">): Receipt {
  const again = state.cards.includes(event.cardId);
  const lines = [
    ...(again ? [COPY.cardAgain(event.cardId)] : []),
    ...(event.note === undefined ? [] : [COPY.cardNote(event.cardId, event.note)]),
  ];
  const cards = again ? state.cards : [...state.cards, event.cardId];
  const chunks: ReplyChunk[] = [
    { kind: "card", payload: event.selection },
    ...lines.map((line): ReplyChunk => ({ kind: "log", text: line })),
  ];
  return { state: { ...state, cards }, chunks };
}

// TODO(U3): put the evidence on the step as `basis` lines under its outcome. Until then each
// line is a technical line naming the step.
function evidenceChunks(label: string, evidence: readonly string[]): ReplyChunk[] {
  return evidence.map((line) => ({ kind: "log", text: COPY.evidence(label, line) }));
}

// A step settled with its result, which also sums up the work so far.
function settleStep(state: ReplyState, event: EventOf<"outcome">): Receipt {
  const done = moveStep(state, event.workId, { status: "done", outcome: event.result });
  const label = stepOf(done.state, event.workId)?.label ?? event.workId;
  const chunks: ReplyChunk[] = [
    ...done.chunks,
    { kind: "summary", text: event.result },
    ...evidenceChunks(label, event.evidence),
  ];
  return { state: done.state, chunks };
}

// TODO(U3): yield the `limitation` block with its `recovery`, so the reader sends the prompt
// in one click. Until then the limitation is a paragraph and the prompt a quoted sentence.
function limitationChunks(
  limitation: string,
  recovery: EventOf<"failure">["recovery"],
): ReplyChunk[] {
  const words = recovery === null ? limitation : `${limitation} ${COPY.recovery(recovery.prompt)}`;
  return [
    { kind: "block", block: "paragraph" },
    { kind: "text", text: words },
  ];
}

// A limitation the reply goes on after: its step fails with it, and the words say it.
function noteLimitation(state: ReplyState, event: EventOf<"failure">): Receipt {
  const failed =
    event.workId === null
      ? noChunks(state)
      : moveStep(state, event.workId, { status: "failed", outcome: event.limitation });
  const words = limitationChunks(event.limitation, event.recovery);
  return { state: failed.state, chunks: [...failed.chunks, ...words] };
}

/**
 * Ends a reply short: the open block's words are yielded whole, every step still running is
 * yielded cancelled, then the terminal failure, so the turn ends interrupted or failed and
 * the reader can try again.
 */
export function endShort(state: ReplyState, failure: Failure): Receipt {
  const closed = closeProse(state); // → the words held, flushed
  const chunks = [...closed.chunks];
  let settled = closed.state;
  for (const step of settled.steps) {
    if (step.status !== "running" && step.status !== "pending") continue;
    const put = putStep(settled, { ...step, status: "cancelled" });
    settled = put.state;
    chunks.push(...put.chunks);
  }
  chunks.push({ kind: "failure", failure });
  return { state: { ...settled, phase: "over" }, chunks, done: true };
}

function onEnd(state: ReplyState, event: EventOf<"end">): Receipt {
  if (event.reason === "answered" || event.reason === "asked")
    return { state: { ...state, phase: "over" }, chunks: [], done: true };
  const words = COPY.ended[event.reason];
  return endShort(state, { title: words.title, detail: event.line ?? words.detail });
}

// Every event after `start`, once the open text block is closed.
function onEvent(state: ReplyState, event: Exclude<Received, { type: "text" }>): Receipt {
  switch (event.type) {
    case "start": // a second start: the stream is not one reply
      return endShort(state, COPY.cutOff);
    case "work":
      return moveStep(state, event.workId, { label: event.label, status: event.status });
    case "card":
      return showCard(state, event);
    case "outcome":
      return settleStep(state, event);
    case "failure":
      return noteLimitation(state, event);
    case "question":
      return {
        state: { ...state, phase: "over" },
        chunks: [{ kind: "question", question: event.question }],
        done: true,
      };
    case "end":
      return onEnd(state, event);
    default: {
      const unhandled: never = event;
      return unhandled;
    }
  }
}

// The first line must be this protocol's `start`.
function begin(state: ReplyState, event: Received): Receipt {
  if (event.type !== "start") return endShort(state, COPY.cutOff);
  if (event.v !== PLAYGROUND_PROTOCOL) return endShort(state, COPY.version);
  return noChunks({ ...state, phase: "reading" });
}

/**
 * Reads one line of the gateway's stream: a known event of this protocol, the `start` of any
 * version, or undefined for a line that is neither.
 */
export function readLine(line: string): Received | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return undefined;
  }
  const event = playgroundEventSchema.safeParse(raw); // → PlaygroundEvent, or the issues
  if (event.success) return event.data;
  const start = anyStartSchema.safeParse(raw); // → a start of another version, or the issues
  return start.success ? start.data : undefined;
}

/**
 * Folds one event of the gateway's stream into the reply's chunks. A replayed `seq` changes
 * nothing; a skipped one means a line was lost, and the reply ends cut off. Text streams
 * through the Markdown emitter; a work item becomes a step; a card, a card chunk; an outcome
 * settles its step and sums up the work; a limitation fails its step and reaches the words; a
 * question docks and ends the reply; `end` ends it, short with a failure for a limit or an
 * upstream that stopped.
 */
export function receive(state: ReplyState, event: Received): Receipt {
  if (state.phase === "over") return { state, chunks: [], done: true };
  if (event.seq < state.next) return noChunks(state);
  if (event.seq > state.next) return endShort(state, COPY.cutOff);
  const counted: ReplyState = { ...state, next: state.next + 1 };
  if (state.phase === "waiting") return begin(counted, event);
  if (event.type === "text") return onText(counted, event);
  const closed = closeProse(counted);
  const handled = onEvent(closed.state, event);
  return { ...handled, chunks: [...closed.chunks, ...handled.chunks] };
}
