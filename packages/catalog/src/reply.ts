import type { Block, Inline, Mark } from "./prose";
import type { ThreadMessage } from "./thread";

/** Where one step of the agent's work stands. Words, never colour alone, tell them apart. */
export type StepStatus = "pending" | "running" | "done" | "failed" | "cancelled";

/**
 * One step of the work behind a reply (ADR-139): a check, a tool run, or a child thread the
 * agent spawned (`threadId`). `outcome` is what a reader needs; `evidence` is a catalog card
 * that backs it. Only `outcome` and `evidence` go in Work details; the logs go one level deeper.
 */
export type WorkStep = {
  id: string;
  label: string;
  status: StepStatus;
  outcome?: string;
  evidence?: unknown;
  threadId?: string;
};

/**
 * The record behind a reply: its steps, its technical lines, the narration it moved past, and
 * what it amounted to in the reader's words once it settled (the disclosure's label).
 */
export type Work = { steps: WorkStep[]; logs: string[]; narration: string[]; summary?: string };

/** Why a reply stopped short, in words for the reader. */
export type Failure = { title: string; detail: string };

/** How a reply that did not complete ended: cut off after some text, before any, or by the user. */
export type Ended = "interrupted" | "failed" | "cancelled";

/**
 * What a reply stream carries besides text (ADR-041, widened): the events a reader needs to
 * follow the work. A plain string is a text chunk, so an agent that streams words alone still
 * satisfies the seam.
 */
export type ReplyEvent =
  /** Progress narration: quiet, brief, factual; supersedes the last one (ADR-139). */
  | { kind: "activity"; text: string }
  /** Words for the current block, set as `mark` says; runs of one mark join up. */
  | { kind: "text"; text: string; mark?: Mark }
  | { kind: "link"; text: string; href: string }
  /** Opens a new block; `item` opens the next item of the list at hand, or a list. */
  | { kind: "block"; block: "paragraph" | "heading" | "list" | "item" }
  /** A catalog card, placed after the prose so far; the next text starts a new paragraph. */
  | { kind: "card"; payload: unknown }
  /** A step of the work, new or updated, by its id. */
  | { kind: "step"; step: WorkStep }
  /** One technical line, kept behind Technical details. */
  | { kind: "log"; text: string }
  /** What the work amounted to, in the reader's words: the disclosure's label once settled. */
  | { kind: "summary"; text: string }
  /** A question the agent is blocked on (ADR-039); the host validates it before it shows. */
  | { kind: "question"; question: unknown }
  /** The reply cannot go on; the turn is marked interrupted or failed, never complete. */
  | { kind: "failure"; failure: Failure };

/** One item of a reply stream: words, or an event around them. */
export type ReplyChunk = string | ReplyEvent;

/** An agent's turn, as the fold below builds it. */
export type AgentMessage = Extract<ThreadMessage, { role: "agent" }>;

const EMPTY_WORK: Work = { steps: [], logs: [], narration: [] };

// The last block of `blocks`, or undefined for none yet.
function lastBlock(blocks: Block[]): Block | undefined {
  return blocks.at(-1);
}

// `blocks` with its last block replaced.
function withLast(blocks: Block[], block: Block): Block[] {
  return [...blocks.slice(0, -1), block];
}

// Appends a run to inline content: onto the last run when it wears the same mark, so words
// streamed one at a time make one `<strong>`, not one per word.
function appendRun(content: Inline[], run: Extract<Inline, { kind: "run" }>): Inline[] {
  const last = content.at(-1);
  if (last?.kind === "run" && last.mark === run.mark)
    return [...content.slice(0, -1), { ...last, text: last.text + run.text }];
  return [...content, run];
}

// Appends an inline to the open block: the last item of an open list, the content of an open
// paragraph or heading, or a new paragraph after a card or at the start.
function appendInline(blocks: Block[], inline: Inline): Block[] {
  const open = lastBlock(blocks);
  if (open === undefined || open.kind === "card")
    return [...blocks, { kind: "paragraph", content: [inline] }];
  if (open.kind === "list") {
    const item = open.items.at(-1) ?? [];
    const items = [...open.items.slice(0, -1), appendTo(item, inline)];
    return withLast(blocks, { ...open, items });
  }
  return withLast(blocks, { ...open, content: appendTo(open.content, inline) });
}

function appendTo(content: Inline[], inline: Inline): Inline[] {
  return inline.kind === "run" ? appendRun(content, inline) : [...content, inline];
}

// Opens a block. `item` adds an item to the list at hand, or starts a list.
function openBlock(blocks: Block[], block: "paragraph" | "heading" | "list" | "item"): Block[] {
  if (block === "list") return [...blocks, { kind: "list", items: [[]] }];
  if (block === "item") {
    const open = lastBlock(blocks);
    if (open?.kind === "list") return withLast(blocks, { ...open, items: [...open.items, []] });
    return [...blocks, { kind: "list", items: [[]] }];
  }
  return [...blocks, { kind: block, content: [] }];
}

/**
 * A turn's words as blocks: its structure so far, or its plain text as one paragraph, so a
 * reply of plain words and a structured one render and grow through the same elements.
 */
export function blocksOf(message: AgentMessage): Block[] {
  if (message.blocks !== undefined) return message.blocks;
  return message.text === ""
    ? []
    : [{ kind: "paragraph", content: [{ kind: "run", text: message.text }] }];
}

// A run of text, appended to the plain projection and to the blocks when the turn has any.
function appendText(message: AgentMessage, run: { text: string; mark?: Mark }): AgentMessage {
  const text = message.text + run.text;
  const structured = message.blocks !== undefined || run.mark !== undefined;
  if (!structured) return { ...message, text };
  return { ...message, text, blocks: appendInline(blocksOf(message), { kind: "run", ...run }) };
}

// Upserts a step by id, keeping the order steps first appeared in.
function upsertStep(steps: WorkStep[], step: WorkStep): WorkStep[] {
  const at = steps.findIndex((each) => each.id === step.id);
  return at === -1 ? [...steps, step] : steps.map((each, i) => (i === at ? step : each));
}

// New narration: it supersedes the current line, which is kept in the work's record.
function narrate(message: AgentMessage, work: Work, text: string): AgentMessage {
  const narration =
    message.activity === undefined ? work.narration : [...work.narration, message.activity];
  return { ...message, activity: text, work: { ...work, narration } };
}

// How a failure ends a turn: interrupted with words already shown, failed with none.
function endedBy(message: AgentMessage): Ended {
  return message.text === "" && (message.blocks ?? []).length === 0 ? "failed" : "interrupted";
}

/**
 * Folds one chunk of a reply into the agent's turn: pure, so the same stream always builds the
 * same turn. Text grows the plain `text` always and the `blocks` once the reply has structure;
 * narration supersedes and is kept; a failure ends the turn as interrupted or failed. A
 * `question` is kept on the turn as what it asks, so the dock can be read back from the record;
 * the host docks it as it streams.
 */
export function applyChunk(message: AgentMessage, chunk: ReplyChunk): AgentMessage {
  if (typeof chunk === "string") return appendText(message, { text: chunk });
  const work = message.work ?? EMPTY_WORK;
  switch (chunk.kind) {
    case "text":
      return appendText(message, { text: chunk.text, mark: chunk.mark });
    case "link":
      return {
        ...message,
        text: message.text + chunk.text,
        blocks: appendInline(blocksOf(message), {
          kind: "link",
          text: chunk.text,
          href: chunk.href,
        }),
      };
    case "block":
      return { ...message, blocks: openBlock(blocksOf(message), chunk.block) };
    case "card":
      return {
        ...message,
        blocks: [...blocksOf(message), { kind: "card", payload: chunk.payload }],
      };
    case "activity":
      return narrate(message, work, chunk.text);
    case "step":
      return { ...message, work: { ...work, steps: upsertStep(work.steps, chunk.step) } };
    case "log":
      return { ...message, work: { ...work, logs: [...work.logs, chunk.text] } };
    case "summary":
      return { ...message, work: { ...work, summary: chunk.text } };
    case "failure":
      return {
        ...message,
        streaming: false,
        activity: undefined,
        ended: endedBy(message),
        failure: chunk.failure,
      };
    case "question":
      return { ...message, asks: chunk.question };
    default: {
      const unhandled: never = chunk;
      return unhandled;
    }
  }
}

/**
 * Whether a turn holds nothing a reader could see: no words, no cards, no work, no question and
 * no ending to explain. A reply that finishes this way (an agent may yield nothing) leaves no
 * turn.
 */
export function isEmptyReply(message: AgentMessage): boolean {
  const { work } = message;
  return (
    blocksOf(message).length === 0 &&
    message.payload === undefined &&
    message.interactive === undefined &&
    message.asks === undefined &&
    message.ended === undefined &&
    (work === undefined || work.steps.length + work.logs.length === 0)
  );
}

/** A reply's turn as it starts: nothing said yet, streaming. */
export function startReply(id: string, time: string): AgentMessage {
  return { id, role: "agent", time, text: "", streaming: true };
}

/** The turn once its stream ends on its own: complete, its narration gone. */
export function completeReply(message: AgentMessage): AgentMessage {
  return { ...message, streaming: false, activity: undefined };
}

/**
 * The turn once the user stopped it: cancelled, never complete, with every running step
 * marked cancelled too, so the record says what stopped and what had finished.
 */
export function cancelReply(message: AgentMessage): AgentMessage {
  const work =
    message.work === undefined
      ? undefined
      : {
          ...message.work,
          steps: message.work.steps.map((step) =>
            step.status === "running" || step.status === "pending"
              ? { ...step, status: "cancelled" as const }
              : step,
          ),
        };
  return { ...message, streaming: false, activity: undefined, ended: "cancelled", work };
}

// What a reader is told when a reply breaks off without saying why (ADR-040): the cause stays in
// the console, and the request is still in the thread to try again.
const BROKE_OFF =
  "I couldn't finish that reply. Your request is still here; try again when you're ready.";

/**
 * The turn once its stream broke off (a refused gateway, a dropped line): failed before any
 * words, interrupted after some, with a plain-words failure, never the cause. A turn that
 * already ended keeps how it ended.
 */
export function failReply(message: AgentMessage): AgentMessage {
  if (message.ended !== undefined) return message;
  const ended = endedBy(message);
  const title = ended === "failed" ? "Reply could not start" : "Reply interrupted";
  return applyChunk(message, { kind: "failure", failure: { title, detail: BROKE_OFF } });
}

/** What the one disclosure above a reply says: its label, a count beside it, and whether it is live. */
export type WorkLabel = { label: string; detail?: string; live: boolean };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// How many steps, and how many need attention, as the count beside the label.
function countOf(work: Work): string | undefined {
  const steps = work.steps.length;
  const short = work.steps.filter(
    (step) => step.status === "failed" || step.status === "cancelled",
  ).length;
  if (steps === 0)
    return work.logs.length === 0
      ? undefined
      : plural(work.logs.length, "technical line", "technical lines");
  const parts = [plural(steps, "check", "checks")];
  if (short > 0) parts.push(short === 1 ? "1 needs attention" : `${short} need attention`);
  return parts.join(" · ");
}

/**
 * What the one disclosure above a reply says (ADR-139, amended): while the reply streams, what
 * it is doing now, live, with the working glyph; once it settles, what the work amounted to in
 * the reply's own words, or "Work finished", "Work incomplete" or "Stopped" when it gave none;
 * beside either, how many checks, and how many need attention. Activity is not value: the
 * label reads as an outcome, never as a list of what ran; and it is a label, so a narration's
 * full stop is dropped from it.
 */
export function workLabel(message: AgentMessage): WorkLabel {
  const work = message.work ?? EMPTY_WORK;
  const detail = countOf(work);
  if (message.streaming === true)
    return { label: (message.activity ?? "Working").replace(/\.$/u, ""), detail, live: true };
  const fallback =
    message.ended === "cancelled"
      ? "Stopped"
      : message.ended === undefined
        ? "Work finished"
        : "Work incomplete";
  return { label: work.summary ?? fallback, detail, live: false };
}
