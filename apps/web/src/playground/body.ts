import type { Selection } from "@yaklabs/catalog/catalog";
import type { PlaygroundEvent } from "@yaklabs/catalog/playground";
import { assertNever } from "./never";

// One visible step of work. `seq` is the event that last updated it, so the status line can
// tell whether answer text has arrived since; `log` keeps earlier labels and narration.
export type Work = {
  id: string;
  label: string;
  status: "running" | "done" | "failed" | "unfinished";
  seq: number;
  narration?: string;
  log: string[];
  outcome?: { result: string; evidence: string[] };
};

// What the answer shows, in arrival order. A text item's `seq` is its first delta's.
export type Item =
  | { kind: "text"; blockId: string; seq: number }
  | { kind: "card"; cardId: string }
  | { kind: "outcome"; workId: string }
  | { kind: "failure"; index: number };

export type Failure = {
  workId: string | null;
  limitation: string;
  recovery: { label: string; prompt: string } | null;
};

// Everything one reply has streamed so far; `text` maps a blockId to its markdown source.
// The maps are partial: a lookup by an id from the stream may miss.
export type Body = {
  lastSeq: number;
  items: Item[];
  text: Partial<Record<string, string>>;
  cards: Partial<Record<string, { selection: Selection; note?: string; revision: number }>>;
  works: Partial<Record<string, Work>>;
  workOrder: string[];
  failures: Failure[];
};

// The events that only add to a reply's body; start, question and end also move its phase.
export type BodyEvent = Extract<
  PlaygroundEvent,
  { type: "text" | "narration" | "work" | "card" | "outcome" | "failure" }
>;

/** A reply's body before its first event. */
export const EMPTY_BODY: Body = {
  lastSeq: -1,
  items: [],
  text: {},
  cards: {},
  works: {},
  workOrder: [],
  failures: [],
};

/** A reply that stops leaves no work spinning: whatever still ran becomes unfinished. */
export function settleWorks(body: Body): Body {
  const works = Object.fromEntries(
    Object.entries(body.works).map(([id, work]) => [
      id,
      work?.status === "running" ? { ...work, status: "unfinished" as const } : work,
    ]),
  ); // → Record<string, Work | undefined>
  return { ...body, works };
}

/** The latest work item still running, which the status line names. */
export function currentWork(body: Body): Work | undefined {
  const running = Object.values(body.works).filter(
    (work): work is Work => work?.status === "running",
  );
  return running.toSorted((a, b) => b.seq - a.seq).at(0);
}

function appendText(body: Body, event: Extract<BodyEvent, { type: "text" }>): Body {
  const known = body.text[event.blockId];
  const item: Item = { kind: "text", blockId: event.blockId, seq: event.seq };
  return {
    ...body,
    items: known === undefined ? [...body.items, item] : body.items,
    text: { ...body.text, [event.blockId]: (known ?? "") + event.delta },
  };
}

// The text block becomes the work's narration and leaves the answer; it is also logged, so
// Work details keeps every narration the work had.
function narrate(body: Body, event: Extract<BodyEvent, { type: "narration" }>): Body {
  const source = body.text[event.blockId];
  const work = body.works[event.workId];
  if (source === undefined || work === undefined) return body;
  const text = Object.fromEntries(
    Object.entries(body.text).filter(([blockId]) => blockId !== event.blockId),
  );
  const narration = source.trim();
  const narrated: Work = { ...work, narration, log: [...work.log, narration] };
  return {
    ...body,
    text,
    items: body.items.filter((item) => item.kind !== "text" || item.blockId !== event.blockId),
    works: { ...body.works, [work.id]: narrated },
  };
}

// A new label for a known work item replaces the old one, which moves to its log.
function updateWork(body: Body, event: Extract<BodyEvent, { type: "work" }>): Body {
  const known = body.works[event.workId];
  const base = { status: event.status, label: event.label, seq: event.seq };
  const work: Work =
    known === undefined
      ? { id: event.workId, log: [], ...base }
      : {
          ...known,
          ...base,
          log: known.label === event.label ? known.log : [...known.log, known.label],
        };
  const workOrder = known === undefined ? [...body.workOrder, event.workId] : body.workOrder;
  return { ...body, works: { ...body.works, [event.workId]: work }, workOrder };
}

// A known cardId is replaced where it stands; its revision remounts the card.
function showCard(body: Body, event: Extract<BodyEvent, { type: "card" }>): Body {
  const known = body.cards[event.cardId];
  const card = {
    selection: event.selection,
    note: event.note,
    revision: known === undefined ? 0 : known.revision + 1,
  };
  const item: Item = { kind: "card", cardId: event.cardId };
  return {
    ...body,
    items: known === undefined ? [...body.items, item] : body.items,
    cards: { ...body.cards, [event.cardId]: card },
  };
}

// An outcome settles its own work item and no other; one the reply never announced is
// recorded under its result, so Work details still shows it.
function settleOutcome(body: Body, event: Extract<BodyEvent, { type: "outcome" }>): Body {
  const known = body.works[event.workId];
  const outcome = { result: event.result, evidence: event.evidence };
  const settled: Work = {
    id: event.workId,
    label: event.result,
    log: [],
    ...known,
    status: "done",
    seq: event.seq,
    outcome,
  };
  const shown = body.items.some((item) => item.kind === "outcome" && item.workId === event.workId);
  return {
    ...body,
    works: { ...body.works, [event.workId]: settled },
    workOrder: known === undefined ? [...body.workOrder, event.workId] : body.workOrder,
    items: shown ? body.items : [...body.items, { kind: "outcome", workId: event.workId }],
  };
}

// A failure is always its own item; the work it names, if still running, stops as failed.
function addFailure(body: Body, event: Extract<BodyEvent, { type: "failure" }>): Body {
  const { workId, limitation, recovery } = event;
  const work = workId === null ? undefined : body.works[workId];
  const works =
    work?.status === "running"
      ? { ...body.works, [work.id]: { ...work, status: "failed" as const, seq: event.seq } }
      : body.works;
  const item: Item = { kind: "failure", index: body.failures.length };
  return {
    ...body,
    works,
    failures: [...body.failures, { workId, limitation, recovery }],
    items: [...body.items, item],
  };
}

/** Folds one body event into a reply's body; the caller has already checked its `seq`. */
export function applyToBody(body: Body, event: BodyEvent): Body {
  switch (event.type) {
    case "text":
      return appendText(body, event);
    case "narration":
      return narrate(body, event);
    case "work":
      return updateWork(body, event);
    case "card":
      return showCard(body, event);
    case "outcome":
      return settleOutcome(body, event);
    case "failure":
      return addFailure(body, event);
    default:
      return assertNever(event);
  }
}
