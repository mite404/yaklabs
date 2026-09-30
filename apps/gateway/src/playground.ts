import { APIError, type Anthropic } from "@anthropic-ai/sdk";
import {
  PLAYGROUND_PROTOCOL,
  playgroundTools,
  type PlaygroundEvent,
  type PlaygroundRequest,
} from "@yaklabs/catalog/playground";
import { toUpstreamMessages } from "./playgroundHistory";
import {
  assistantContent,
  narrationTextIds,
  newRound,
  readEvent,
  type Round,
} from "./playgroundRound";
import {
  hasAnswer,
  initialTurn,
  narrate,
  stamp,
  translateToolUse,
  type EventDraft,
  type TurnState,
} from "./playgroundTools";

/** The model the playground talks to and its per-round budget; the app passes its own. */
export type PlaygroundUpstream = { client: Anthropic; model: string; maxTokens: number };

type Messages = Anthropic.MessageParam[];
type UpstreamEvents = AsyncIterable<Anthropic.RawMessageStreamEvent>;

// How a round ended, with the turn state it left behind (every seq it used included).
// `narrated` is set once the text before the round's first tool call went to running work.
type RoundEnd = {
  state: TurnState;
  round: Round;
  results: Anthropic.ToolResultBlockParam[];
  asked: boolean;
  broken: boolean;
  narrated: boolean;
};

// What the loop does after a round: stop with closing events, or send the results and go on.
type Decision =
  | { kind: "stop"; drafts: EventDraft[] }
  | { kind: "continue"; drafts: EventDraft[]; messages: Messages };

// The playground's own prompt: the page sends only the user's turns.
const SYSTEM_PROMPT = `You are Kay's assistant in a playground where people try out how you work.
You cannot fetch real, live or external data. Chart only numbers the user gave you, or plainly \
illustrative numbers whose source says they are illustrative.

The user sees each tool call as its own part of the page, so tools carry the content:
- Before each step of work, call update_work with a short factual label. Reuse its workId to \
update it, and mark it done or failed when the step ends.
- Never write prose before a tool call. Progress belongs in update_work labels, not in text.
- Show numbers only with show_card. Reuse a cardId to replace that card.
- When you need a decision only the user can make, call ask_question and then stop.
- Settle each work item with report_outcome. Its evidence says how you got the result (the \
inputs and the rule you used), never the same numbers the card already shows.
- Whenever the user asks for something you cannot do, such as real or past data, you must call \
report_failure with the limitation and a recovery prompt the user could send instead. Never \
explain a limitation only in prose.

Your final answer adds only what the cards, outcomes and failures do not already say: one to \
three plain sentences, and "-" lists or **bold** only when they help. Never repeat a card's \
numbers, an outcome or a failure in prose. After report_failure, close with one short sentence \
that does not restate the limitation. No tables and no headings.`;

// Rounds one turn may take; Kimi was seen making one tool call per round.
const MAX_ROUNDS = 8;
const TOOLS: Anthropic.Tool[] = [...playgroundTools];
const CUT_SHORT = "I stopped before finishing this reply.";
const NO_RESPONSE = "The model stopped responding.";
const NO_ANSWER = "I finished without an answer.";
const encoder = new TextEncoder();

const failureDrafts = (limitation: string, reason: "limit" | "upstream"): EventDraft[] => [
  { type: "failure", workId: null, limitation, recovery: null },
  { type: "end", reason },
];

// A turn that answered: a reply with nothing to show says so rather than ending blank.
const answeredDrafts = (state: TurnState): EventDraft[] => [
  ...(hasAnswer(state)
    ? []
    : [{ type: "failure" as const, workId: null, limitation: NO_ANSWER, recovery: null }]),
  { type: "end", reason: "answered" },
];

// The round's verdict. Pure: `messages` is what the next round sends when there is one.
const decide = (
  { state, round, results, asked, broken }: RoundEnd,
  messages: Messages,
): Decision => {
  if (broken) return { kind: "stop", drafts: failureDrafts(NO_RESPONSE, "upstream") };
  if (asked) return { kind: "stop", drafts: [{ type: "end", reason: "asked" }] };
  if (round.stop === null) return { kind: "stop", drafts: failureDrafts(NO_RESPONSE, "upstream") };
  if (round.stop === "max_tokens")
    return { kind: "stop", drafts: failureDrafts(CUT_SHORT, "limit") };
  if (round.stop !== "tool_use" || results.length === 0)
    return { kind: "stop", drafts: answeredDrafts(state) };
  if (state.round >= MAX_ROUNDS) return { kind: "stop", drafts: failureDrafts(CUT_SHORT, "limit") };
  const next: Messages = [
    ...messages,
    { role: "assistant", content: assistantContent(round) },
    { role: "user", content: results },
  ];
  return { kind: "continue", drafts: [], messages: next };
};

// Sends one round upstream; resolves once the upstream accepts it, or throws its APIError.
const openRound = (
  upstream: PlaygroundUpstream,
  messages: Messages,
  signal: AbortSignal,
): Promise<UpstreamEvents> =>
  upstream.client.messages.create(
    {
      model: upstream.model,
      max_tokens: upstream.maxTokens,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
      stream: true,
    },
    { signal },
  );

// The text before the round's first tool call becomes narration once a tool call has shown
// which work is running; the blocks before a tool call are whole by the time it arrives.
const narrateLead = (end: RoundEnd): { end: RoundEnd; events: PlaygroundEvent[] } => {
  if (end.narrated) return { end, events: [] };
  const drafts = narrate(end.state, narrationTextIds(end.round)); // → narration drafts
  if (drafts.length === 0) return { end, events: [] };
  const { state, events } = stamp(end.state, drafts);
  return { end: { ...end, state, narrated: true }, events };
};

// One upstream event folded into the round, with the page events it makes. Pure.
const advance = (
  end: RoundEnd,
  event: Anthropic.RawMessageStreamEvent,
): { end: RoundEnd; events: PlaygroundEvent[] } => {
  const step = readEvent(end.round, event); // → { round, text?, tool? }
  const text = stamp(end.state, step.text === undefined ? [] : [{ type: "text", ...step.text }]);
  const read: RoundEnd = { ...end, round: step.round, state: text.state };
  if (step.tool === undefined) return { end: read, events: text.events };
  const { state, events, result } = translateToolUse(read.state, step.tool); // → Translation
  const translated: RoundEnd =
    result === "asked"
      ? { ...read, state, asked: true }
      : { ...read, state, results: [...read.results, result] };
  const narrated = narrateLead(translated); // → { end, events }
  return { end: narrated.end, events: [...text.events, ...events, ...narrated.events] };
};

// Only the upstream failing (an APIError, which covers a dropped connection and an abort)
// means the model stopped responding. Anything else is a bug: it is logged, and the turn
// still ends with the upstream failure so the page never hangs.
const noteFailure = (error: unknown): void => {
  if (error instanceof APIError) return;
  // oxlint-disable-next-line eslint/no-console -- a bug in the loop must reach the Worker's logs
  console.error("[playground] round failed:", error);
};

// Streams one round's page events and returns how it ended. An upstream failure mid-round
// ends it `broken` with the seq it reached, so the closing events keep counting from there.
async function* streamRound(
  events: UpstreamEvents,
  start: TurnState,
): AsyncGenerator<PlaygroundEvent, RoundEnd> {
  let end: RoundEnd = {
    state: start,
    round: newRound(start.round),
    results: [],
    asked: false,
    broken: false,
    narrated: false,
  };
  try {
    for await (const event of events) {
      const next = advance(end, event); // → { end, events }
      end = next.end;
      yield* next.events;
      // A question ends the turn here; leaving the loop cancels the rest of the round.
      if (end.asked) return end;
    }
  } catch (error) {
    noteFailure(error);
    return { ...end, broken: true };
  }
  return end;
}

// Opens the next round, or undefined when the upstream refused it.
const tryOpenRound = async (
  upstream: PlaygroundUpstream,
  messages: Messages,
  signal: AbortSignal,
): Promise<UpstreamEvents | undefined> => {
  try {
    return await openRound(upstream, messages, signal);
  } catch (error) {
    noteFailure(error);
    return undefined;
  }
};

// The playground's tool loop, the only part that talks to the model: it opens a round, turns
// each upstream event into page events, answers the tool calls and goes round again until the
// model answers, asks, hits a limit or stops responding. The first event is `start`, the last
// is `end`, and `seq` counts up from 0 without a gap. A closed browser (`signal`) stops it.
// It throws the first round's `APIError` before `start`, so the route can answer 502 instead.
async function* playgroundEvents(
  upstream: PlaygroundUpstream,
  request: PlaygroundRequest,
  signal: AbortSignal,
): AsyncGenerator<PlaygroundEvent, void> {
  let messages = toUpstreamMessages(request); // → MessageParam[]
  let events: UpstreamEvents | undefined = await openRound(upstream, messages, signal);
  const opened = stamp(initialTurn, [{ type: "start", v: PLAYGROUND_PROTOCOL }]);
  let state = opened.state;
  yield* opened.events;
  while (events !== undefined) {
    const end: RoundEnd = yield* streamRound(events, { ...state, round: state.round + 1 });
    if (signal.aborted) return;
    const decision = decide(end, messages); // → stop | continue
    const stamped = stamp(end.state, decision.drafts);
    state = stamped.state;
    yield* stamped.events;
    if (decision.kind === "stop") return;
    messages = decision.messages;
    // oxlint-disable-next-line no-await-in-loop -- each round needs the last round's tool results
    events = await tryOpenRound(upstream, messages, signal);
  }
  if (signal.aborted) return;
  yield* stamp(state, failureDrafts(NO_RESPONSE, "upstream")).events;
}

// One event per line, as the page reads them.
const ndjsonLine = (event: PlaygroundEvent): Uint8Array =>
  encoder.encode(`${JSON.stringify(event)}\n`);

/**
 * Starts the playground's reply and waits for the upstream to accept the first round, so a
 * refusal becomes a status code before a byte of the body is sent (like `/api/messages`).
 * Cancelling the returned stream stops the loop and the round in flight.
 *
 * @returns an NDJSON stream of `PlaygroundEvent`s, one per line.
 * @throws the upstream's `APIError` when it refuses the first round.
 */
export async function openPlayground(
  upstream: PlaygroundUpstream,
  request: PlaygroundRequest,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const events = playgroundEvents(upstream, request, signal); // → AsyncGenerator<PlaygroundEvent>
  const first = await events.next(); // → the `start` event, or throws the first round's refusal
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (first.done === true) controller.close();
      else controller.enqueue(ndjsonLine(first.value));
    },
    async pull(controller) {
      const next = await events.next();
      if (next.done === true) controller.close();
      else controller.enqueue(ndjsonLine(next.value));
    },
    async cancel() {
      await events.return();
    },
  });
}
