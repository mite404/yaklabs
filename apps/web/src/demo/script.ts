import type { Block, Inline } from "@yaklabs/catalog/prose";
import type { ReplyChunk, ReplyEvent } from "@yaklabs/catalog/reply";

// Time between streamed words at 1x: the lab stand-in's pace, live enough to read as typing.
const WORD_MS = 45;

/** One chunk of a reply and the pause before it, in milliseconds at 1x. */
export type Timed = { after: number; chunk: ReplyChunk };

/**
 * One beat of a scripted conversation. A user beat is performed through the thread's own
 * controls (the compose box, the docked question, Stop, Try again); a reply beat is what the
 * scripted agent answers the request before it with. A user beat waits `after` ms once the
 * reply before it has settled, or, with `overlap`, once the user beat before it was performed,
 * so a second request can go out while the first reply still streams.
 */
export type Beat =
  | { kind: "user"; after: number; text: string; overlap?: true }
  | { kind: "answer"; after: number; text: string }
  | { kind: "stop"; after: number }
  | { kind: "retry"; after: number }
  | { kind: "reply"; events: Timed[] };

/** A child thread the agent spawns: what the sidebar calls it and the request it was given. */
export type ChildScript = { title: string; request: string };

/** One scenario: the workspace it plays in, its children, and its beats in order. */
export type Script = {
  id: string;
  /** What the scenario picker calls it. */
  label: string;
  /** One line on what this scenario shows, for the picker's description. */
  shows: string;
  project: string;
  thread: string;
  children: Record<string, ChildScript>;
  beats: Beat[];
};

// The words of a run, each with the whitespace that precedes it, so joining them back gives
// the run exactly; a code run is one word, since splitting a token would show broken code.
function wordsOf(run: Extract<Inline, { kind: "run" }>): string[] {
  if (run.mark === "code") return [run.text];
  return run.text.match(/\s*\S+\s*/g) ?? [];
}

// One inline as timed chunks, a word at a time.
function inlineChunks(inline: Inline, first: boolean): Timed[] {
  if (inline.kind === "link") return [{ after: first ? 0 : WORD_MS, chunk: inline }];
  return wordsOf(inline).map((word, i) => ({
    after: first && i === 0 ? 0 : WORD_MS,
    chunk: { kind: "text", text: word, mark: inline.mark } satisfies ReplyEvent,
  }));
}

function contentChunks(content: Inline[]): Timed[] {
  return content.flatMap((inline, i) => inlineChunks(inline, i === 0));
}

/**
 * Authored blocks as the stream an agent would send them in: a block boundary, then its words
 * one at a time, `WORD_MS` apart; a card arrives whole. `pause` is the wait before the first.
 */
export function stream(blocks: Block[], pause = 0): Timed[] {
  return blocks.flatMap((block, at) => {
    const lead = at === 0 ? pause : WORD_MS * 4;
    if (block.kind === "card") return [{ after: lead, chunk: block }];
    if (block.kind === "list")
      return block.items.flatMap((item, i) => [
        {
          after: i === 0 ? lead : WORD_MS * 2,
          chunk: { kind: "block", block: i === 0 ? "list" : "item" } as const,
        },
        ...contentChunks(item),
      ]);
    return [
      { after: lead, chunk: { kind: "block", block: block.kind } as const },
      ...contentChunks(block.content),
    ];
  });
}

/** One event after a pause. */
export const at = (after: number, chunk: ReplyChunk): Timed => ({ after, chunk });

/** Progress narration after a pause. */
export const activity = (after: number, text: string): Timed =>
  at(after, { kind: "activity", text });

/** A technical line after a pause. */
export const log = (after: number, text: string): Timed => at(after, { kind: "log", text });

/** How long a reply's events take at 1x, for a check that a scenario fits the walkthrough. */
export function durationOf(events: Timed[]): number {
  return events.reduce((sum, timed) => sum + timed.after, 0);
}
