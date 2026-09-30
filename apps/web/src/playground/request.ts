import type { PlaygroundRequest, UserInput } from "@yaklabs/catalog/playground";
import { EMPTY_BODY, type Body } from "./body";
import { assertNever } from "./never";
import type { AgentTurn, Asked, Cause, PlaygroundState } from "./state";

type SentExchange = PlaygroundRequest["exchanges"][number];
type SentAgent = NonNullable<SentExchange["agent"]>;

// The request contract's caps: 50 exchanges, 12 of each record, 20,000 characters of text.
const MAX_EXCHANGES = 50;
const MAX_RECORDS = 12;
const MAX_TEXT = 20_000;

// The answer prose only: narration already left `items`, so it is never sent back.
function answerText(body: Body): string {
  return body.items
    .flatMap((item) => (item.kind === "text" ? [(body.text[item.blockId] ?? "").trim()] : []))
    .filter((source) => source !== "")
    .join("\n\n")
    .slice(0, MAX_TEXT);
}

function sentCards(body: Body): SentAgent["cards"] {
  return body.items.flatMap((item) => {
    if (item.kind !== "card") return [];
    const card = body.cards[item.cardId];
    return card === undefined ? [] : [{ cardId: item.cardId, selection: card.selection }];
  });
}

function sentOutcomes(body: Body): SentAgent["outcomes"] {
  return body.items.flatMap((item) => {
    if (item.kind !== "outcome") return [];
    const outcome = body.works[item.workId]?.outcome;
    return outcome === undefined ? [] : [{ workId: item.workId, result: outcome.result }];
  });
}

function agentRecord(body: Body, question?: Asked, cause?: Cause): SentAgent {
  const limitations = body.failures.map((failure) => failure.limitation);
  const failures = [...limitations, ...(cause === undefined ? [] : [cause.title])];
  return {
    text: answerText(body),
    cards: sentCards(body).slice(0, MAX_RECORDS),
    outcomes: sentOutcomes(body).slice(0, MAX_RECORDS),
    failures: failures.slice(-MAX_RECORDS).map((limitation) => ({ limitation })),
    ...(question === undefined ? {} : { question }),
  };
}

// What the model is told a past reply said. A failed reply carries its cause as a failure,
// so the model knows the reply never arrived whole and the turn is never empty.
function sentAgent(turn: AgentTurn): SentAgent | undefined {
  switch (turn.phase) {
    case "waiting":
    case "streaming":
      return undefined;
    case "asked":
    case "resolved":
      return agentRecord(turn.body, turn.asked);
    case "done":
      return agentRecord(turn.body);
    case "failed":
      return agentRecord(turn.body ?? EMPTY_BODY, undefined, turn.cause);
    default:
      return assertNever(turn);
  }
}

// Keeps the latest exchanges within the cap, starting on a message: an answer or a skip
// cut from its question would mean nothing to the model.
function recent(past: SentExchange[]): SentExchange[] {
  const kept = past.slice(-(MAX_EXCHANGES - 1));
  const start = kept.findIndex((exchange) => exchange.user.kind === "say");
  return start === -1 ? [] : kept.slice(start);
}

/**
 * The body of POST /api/playground: every settled exchange so far, then `next`, the one being
 * asked now. A reply still streaming is left out; a failed one is sent with what it showed.
 */
export function toPlaygroundRequest(state: PlaygroundState, next: UserInput): PlaygroundRequest {
  const past = state.exchanges.flatMap((exchange) => {
    const agent = sentAgent(exchange.agent); // → SentAgent | undefined
    return agent === undefined ? [] : [{ user: exchange.user, agent }];
  }); // → SentExchange[]
  return { exchanges: [...recent(past), { user: next }] };
}
