import type { AwaitingInput } from "@yaklabs/catalog/awaiting";
import type { PlaygroundEvent, UserInput } from "@yaklabs/catalog/playground";
import { EMPTY_BODY, applyToBody, currentWork, settleWorks, type Body } from "./body";
import { assertNever } from "./never";

export type Asked = { questionId: string; question: AwaitingInput };
export type Reply = { kind: "answer"; text: string; at: string } | { kind: "skip" };
export type Cause = { title: string; detail: string; retry: boolean };

// One reply's lifecycle: sent, streaming, then asked (and later resolved), done or failed.
export type AgentTurn =
  | { phase: "waiting" }
  | { phase: "streaming"; body: Body }
  | { phase: "asked"; body: Body; asked: Asked }
  | { phase: "resolved"; body: Body; asked: Asked; reply: Reply }
  | { phase: "done"; body: Body }
  | { phase: "failed"; body: Body | null; cause: Cause };

// `at` is the display time the user sent it.
export type Exchange = { id: string; user: UserInput; at: string; agent: AgentTurn };

export type PlaygroundState = { exchanges: Exchange[] };

export type PlaygroundAction =
  | { kind: "send"; exchangeId: string; user: UserInput; at: string }
  | { kind: "event"; exchangeId: string; event: PlaygroundEvent }
  | { kind: "closed"; exchangeId: string }
  | { kind: "broke"; exchangeId: string; cause: Cause }
  | { kind: "retry"; exchangeId: string };

/** The page before anything is sent. */
export const initialPlayground: PlaygroundState = { exchanges: [] };

/** The cause a stream that closes before its `end` event settles with. */
export const CUT_OFF: Cause = {
  title: "The reply was cut off.",
  detail: "The connection closed before the reply finished.",
  retry: true,
};

/** Whether the last reply still holds the page: streaming, or waiting on its question. */
export function isLocked(state: PlaygroundState): boolean {
  const phase = state.exchanges.at(-1)?.agent.phase;
  return phase === "waiting" || phase === "streaming" || phase === "asked";
}

/**
 * Whether `user` may be sent now: a message only when nothing holds the page, an answer or
 * a skip only to the question the last reply is waiting on.
 */
export function canSend(state: PlaygroundState, user: UserInput): boolean {
  const agent = state.exchanges.at(-1)?.agent;
  switch (user.kind) {
    case "say":
      return !isLocked(state);
    case "answer":
    case "skip":
      return agent?.phase === "asked" && agent.asked.questionId === user.questionId;
    default:
      return assertNever(user);
  }
}

/**
 * The status line's words while a reply streams: the current work's narration or label,
 * until answer text arrives after that work's last update (text replaces narration).
 */
export function statusLine(turn: AgentTurn): string | undefined {
  if (turn.phase !== "streaming") return undefined;
  const { body } = turn;
  const work = currentWork(body);
  if (work === undefined) return undefined;
  const answered = body.items.some(
    (item) =>
      item.kind === "text" && item.seq > work.seq && (body.text[item.blockId] ?? "").trim() !== "",
  );
  return answered ? undefined : (work.narration ?? work.label);
}

function receive(turn: AgentTurn, event: PlaygroundEvent): AgentTurn {
  if (turn.phase !== "waiting" && turn.phase !== "streaming") return turn;
  const current = turn.phase === "waiting" ? EMPTY_BODY : turn.body;
  if (event.seq <= current.lastSeq) return turn;
  const body = { ...current, lastSeq: event.seq };
  switch (event.type) {
    case "start":
      return { phase: "streaming", body };
    case "text":
    case "narration":
    case "work":
    case "card":
    case "outcome":
    case "failure":
      return { phase: "streaming", body: applyToBody(body, event) };
    case "question":
      return {
        phase: "asked",
        body: settleWorks(body),
        asked: { questionId: event.questionId, question: event.question },
      };
    case "end":
      return { phase: "done", body: settleWorks(body) };
    default:
      return assertNever(event);
  }
}

function breakOff(turn: AgentTurn, cause: Cause): AgentTurn {
  if (turn.phase === "waiting") return { phase: "failed", body: null, cause };
  if (turn.phase === "streaming") return { phase: "failed", body: settleWorks(turn.body), cause };
  return turn;
}

function retry(turn: AgentTurn): AgentTurn {
  return turn.phase === "failed" && turn.cause.retry ? { phase: "waiting" } : turn;
}

// The question a reply waits on, settled by the answer or skip that is being sent.
function resolveQuestion(exchanges: Exchange[], user: UserInput, at: string): Exchange[] {
  const last = exchanges.at(-1);
  if (user.kind === "say" || last?.agent.phase !== "asked") return exchanges;
  const { body, asked } = last.agent;
  const reply: Reply =
    user.kind === "answer" ? { kind: "answer", text: user.text, at } : { kind: "skip" };
  const agent: AgentTurn = { phase: "resolved", body, asked, reply };
  return [...exchanges.slice(0, -1), { ...last, agent }];
}

function send(
  state: PlaygroundState,
  action: Extract<PlaygroundAction, { kind: "send" }>,
): PlaygroundState {
  if (!canSend(state, action.user)) return state;
  const exchange: Exchange = {
    id: action.exchangeId,
    user: action.user,
    at: action.at,
    agent: { phase: "waiting" },
  };
  return { exchanges: [...resolveQuestion(state.exchanges, action.user, action.at), exchange] };
}

// Only the last exchange is live; an action for any earlier one is stale and changes nothing.
function updateLast(
  state: PlaygroundState,
  exchangeId: string,
  update: (turn: AgentTurn) => AgentTurn,
): PlaygroundState {
  const last = state.exchanges.at(-1);
  if (last?.id !== exchangeId) return state;
  const agent = update(last.agent);
  if (agent === last.agent) return state;
  return { exchanges: [...state.exchanges.slice(0, -1), { ...last, agent }] };
}

/**
 * The playground's whole behaviour: folds one action into the page state. Replays are
 * no-ops: a repeated `seq`, a stale exchange or an event after the reply settled returns the
 * same state object.
 */
export function reducePlayground(
  state: PlaygroundState,
  action: PlaygroundAction,
): PlaygroundState {
  switch (action.kind) {
    case "send":
      return send(state, action);
    case "event":
      return updateLast(state, action.exchangeId, (turn) => receive(turn, action.event));
    case "closed":
      return updateLast(state, action.exchangeId, (turn) => breakOff(turn, CUT_OFF));
    case "broke":
      return updateLast(state, action.exchangeId, (turn) => breakOff(turn, action.cause));
    case "retry":
      return updateLast(state, action.exchangeId, retry);
    default:
      return assertNever(action);
  }
}
