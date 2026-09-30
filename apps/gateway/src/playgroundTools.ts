import type { Anthropic } from "@anthropic-ai/sdk";
import { resolveAwaiting } from "@yaklabs/catalog/awaiting";
import { resolve } from "@yaklabs/catalog/catalog";
import {
  reportFailureInputSchema,
  reportOutcomeInputSchema,
  showCardInputSchema,
  updateWorkInputSchema,
  type PlaygroundEvent,
} from "@yaklabs/catalog/playground";
import type { z } from "zod";

// An event before the gateway gives it its place in the stream.
type Unstamped<E> = E extends unknown ? Omit<E, "seq"> : never;

/** A playground event without its `seq`; `stamp` numbers it. */
export type EventDraft = Unstamped<PlaygroundEvent>;

/**
 * Everything one turn counts, carried from event to event so every limit is checked against
 * the same numbers: the next `seq`, rounds opened, tool calls made, the distinct cards shown,
 * the running work items (most recent last) and validation failures per tool name.
 */
export type TurnState = Readonly<{
  seq: number;
  round: number;
  toolCalls: number;
  cardIds: readonly string[];
  running: readonly string[];
  failures: Readonly<Record<string, number>>;
}>;

/** A tool call read whole from the stream; `input` is `{ ok: false }` when its JSON broke. */
export type ToolCall = {
  id: string;
  name: string;
  input: { ok: true; value: unknown } | { ok: false };
};

/**
 * What one tool call becomes: the events the page sees and the tool_result the model reads
 * next round, or "asked" when a question ends the turn and the user's reply is the result.
 */
export type Translation = {
  state: TurnState;
  events: PlaygroundEvent[];
  result: Anthropic.ToolResultBlockParam | "asked";
};

/** A turn before its first event. */
export const initialTurn: TurnState = {
  seq: 0,
  round: 0,
  toolCalls: 0,
  cardIds: [],
  running: [],
  failures: {},
};

// Tool calls one turn may make; Kimi was seen making one per round.
const MAX_TOOL_CALLS = 16;
// Distinct cards one turn may show; updating a card by its id does not count.
const MAX_CARDS = 6;
const RECOVERY_LABEL = "Send this";

// A handler's verdict. "invalid" counts toward the tool's validation failures; "refused" is a
// limit, not a mistake in the input.
type Verdict =
  | { kind: "shown"; state: TurnState; drafts: EventDraft[]; reply: string }
  | { kind: "asked"; drafts: EventDraft[] }
  | { kind: "invalid"; reason: string }
  | { kind: "refused"; reason: string };

type Handler = (state: TurnState, input: unknown, id: string) => Verdict;

// Zod issues as one line the model can act on, in the style of `resolveAwaiting`.
const formatIssues = (error: z.ZodError): string =>
  error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");

const withRunning = (state: TurnState, workId: string, running: boolean): TurnState => {
  const others = state.running.filter((id) => id !== workId);
  return { ...state, running: running ? [...others, workId] : others };
};

const updateWork: Handler = (state, input) => {
  const parsed = updateWorkInputSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid", reason: formatIssues(parsed.error) };
  const { workId, label, status } = parsed.data;
  const next = withRunning(state, workId, status === "running");
  return {
    kind: "shown",
    state: next,
    drafts: [{ type: "work", workId, label, status }],
    reply: "ok",
  };
};

const showCard: Handler = (state, input) => {
  const parsed = showCardInputSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid", reason: formatIssues(parsed.error) };
  const { cardId, card } = parsed.data;
  const known = state.cardIds.includes(cardId);
  if (!known && state.cardIds.length >= MAX_CARDS)
    return { kind: "refused", reason: "card limit reached" };
  const next = known ? state : { ...state, cardIds: [...state.cardIds, cardId] };
  const resolution = resolve(card); // → approved | fallback | empty | rejected
  switch (resolution.kind) {
    case "approved":
    case "empty":
      return {
        kind: "shown",
        state: next,
        drafts: [{ type: "card", cardId, selection: card }],
        reply: "shown",
      };
    case "fallback": {
      const { selection, reason } = resolution;
      const drafts: EventDraft[] = [{ type: "card", cardId, selection, note: reason }];
      return { kind: "shown", state: next, drafts, reply: `shown as a table: ${reason}` };
    }
    case "rejected":
      return { kind: "invalid", reason: resolution.reason };
    default: {
      const unhandled: never = resolution;
      return unhandled;
    }
  }
};

const askQuestion: Handler = (_state, input, id) => {
  const payload =
    typeof input === "object" && input !== null && "question" in input ? input.question : undefined;
  const resolution = resolveAwaiting(payload); // → approved | malformed
  if (resolution.kind === "malformed") return { kind: "invalid", reason: resolution.reason };
  return {
    kind: "asked",
    drafts: [{ type: "question", questionId: id, question: resolution.question }],
  };
};

const reportOutcome: Handler = (state, input) => {
  const parsed = reportOutcomeInputSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid", reason: formatIssues(parsed.error) };
  const { workId, result, evidence } = parsed.data;
  const drafts: EventDraft[] = [{ type: "outcome", workId, result, evidence }];
  return { kind: "shown", state: withRunning(state, workId, false), drafts, reply: "ok" };
};

const reportFailure: Handler = (state, input) => {
  const parsed = reportFailureInputSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid", reason: formatIssues(parsed.error) };
  const { workId, limitation, recovery_prompt: prompt } = parsed.data;
  const recovery = prompt === undefined ? null : { label: RECOVERY_LABEL, prompt };
  const drafts: EventDraft[] = [{ type: "failure", workId: workId ?? null, limitation, recovery }];
  return { kind: "shown", state, drafts, reply: "ok" };
};

// The tools the prompt offers, by name. A name missing here is an unknown tool; a Map, so a
// name like "constructor" finds nothing inherited.
const HANDLERS: ReadonlyMap<string, Handler> = new Map([
  ["update_work", updateWork],
  ["show_card", showCard],
  ["ask_question", askQuestion],
  ["report_outcome", reportOutcome],
  ["report_failure", reportFailure],
]);

const toolResult = (
  id: string,
  content: string,
  isError: boolean,
): Anthropic.ToolResultBlockParam =>
  isError
    ? { type: "tool_result", tool_use_id: id, content, is_error: true }
    : { type: "tool_result", tool_use_id: id, content };

// The handler's verdict for a call, before any counting.
const judge = (state: TurnState, { id, name, input }: ToolCall): Verdict => {
  const handler = HANDLERS.get(name);
  if (handler === undefined)
    return {
      kind: "invalid",
      reason: `Unknown tool ${name}. Use one of: ${[...HANDLERS.keys()].join(", ")}.`,
    };
  if (!input.ok) return { kind: "invalid", reason: "The input was not valid JSON." };
  return handler(state, input.value, id);
};

// A failed call: an input mistake counts toward "answer in prose" on its second time.
const rejectCall = (
  state: TurnState,
  call: ToolCall,
  verdict: Verdict & { reason: string },
): Translation => {
  if (verdict.kind === "refused")
    return { state, events: [], result: toolResult(call.id, verdict.reason, true) };
  const count = (state.failures[call.name] ?? 0) + 1;
  const reason = count >= 2 ? `${verdict.reason} Answer in prose instead.` : verdict.reason;
  const next = { ...state, failures: { ...state.failures, [call.name]: count } };
  return { state: next, events: [], result: toolResult(call.id, reason, true) };
};

/** Numbers drafts from the turn's next `seq`, in order. */
export function stamp(
  state: TurnState,
  drafts: readonly EventDraft[],
): { state: TurnState; events: PlaygroundEvent[] } {
  const events = drafts.map((draft, index): PlaygroundEvent => ({
    ...draft,
    seq: state.seq + index,
  }));
  return { state: { ...state, seq: state.seq + drafts.length }, events };
}

/**
 * Checks one tool call with the catalog's own validators and translates it into page events
 * plus the tool_result the model reads. Invalid input never reaches the page; its reason goes
 * back to the model as an error, and a tool's second failure in a turn asks for prose instead.
 */
export function translateToolUse(state: TurnState, call: ToolCall): Translation {
  const counted = { ...state, toolCalls: state.toolCalls + 1 };
  if (counted.toolCalls > MAX_TOOL_CALLS)
    return {
      state: counted,
      events: [],
      result: toolResult(call.id, "Tool call limit reached. Answer in prose now.", true),
    };
  const verdict = judge(counted, call); // → shown | asked | invalid | refused
  switch (verdict.kind) {
    case "shown": {
      const stamped = stamp(verdict.state, verdict.drafts);
      return { ...stamped, result: toolResult(call.id, verdict.reply, false) };
    }
    case "asked":
      return { ...stamp(counted, verdict.drafts), result: "asked" };
    case "invalid":
    case "refused":
      return rejectCall(counted, call, verdict);
    default: {
      const unhandled: never = verdict;
      return unhandled;
    }
  }
}

/**
 * The narration events for text a round streamed before its tool calls: each block becomes
 * progress for the most recent running work item. With no work running, the text stays prose.
 */
export function narrate(state: TurnState, blockIds: readonly string[]): EventDraft[] {
  const workId = state.running.at(-1);
  if (workId === undefined) return [];
  return blockIds.map((blockId) => ({ type: "narration", blockId, workId }));
}
