// ADR-140's Quiet prose contract: structured paragraph/list/heading blocks of inline segments,
// revealed by word count so streaming and completed content share one semantic tree, never a
// Markdown string re-parsed on every render.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "code"; text: string };

export type Block =
  | { kind: "heading"; content: Inline[] }
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "list"; items: Inline[][] };

export const text = (value: string): Inline => ({ kind: "text", text: value });
export const strong = (value: string): Inline => ({ kind: "strong", text: value });
export const em = (value: string): Inline => ({ kind: "em", text: value });
export const link = (value: string, href: string): Inline => ({ kind: "link", text: value, href });
export const code = (value: string): Inline => ({ kind: "code", text: value });

export const paragraph = (content: Inline[]): Block => ({ kind: "paragraph", content });
export const heading = (content: Inline[]): Block => ({ kind: "heading", content });
export const list = (items: Inline[][]): Block => ({ kind: "list", items });

// A code segment reveals as one unit: splitting a token mid-way would show broken code.
function wordsOf(segment: Inline): string[] {
  return segment.kind === "code" ? [segment.text] : segment.text.split(/\s+/).filter(Boolean);
}

// Where each word ends within a segment's own text, so a partial reveal can slice the original
// string - keeping its exact whitespace - instead of rejoining trimmed words with a single space.
function wordEnds(value: string): number[] {
  const ends: number[] = [];
  const matches = value.matchAll(/\S+/g);
  for (const match of matches) ends.push(match.index + match[0].length);
  return ends;
}

function rebuild(segment: Inline, wordCount: number): Inline {
  if (segment.kind === "code") return segment;
  const end = wordEnds(segment.text)[wordCount - 1] ?? 0;
  return { ...segment, text: segment.text.slice(0, end) };
}

function inlineWords(segments: Inline[]): number {
  return segments.reduce((sum, segment) => sum + wordsOf(segment).length, 0);
}

/** Total words across every block, so a caller can turn "80% done" into a word budget. */
export function countWords(blocks: Block[]): number {
  return blocks.reduce(
    (sum, block) =>
      sum +
      (block.kind === "list"
        ? block.items.reduce((s, item) => s + inlineWords(item), 0)
        : inlineWords(block.content)),
    0,
  );
}

// Takes the first `budget` words from a run of inline segments, stopping mid-segment when the
// budget runs out there; returns the segments actually reached and the budget left after them.
function takeInline(segments: Inline[], budget: number): { taken: Inline[]; left: number } {
  const taken: Inline[] = [];
  let left = budget;
  for (const segment of segments) {
    if (left <= 0) break;
    const words = wordsOf(segment);
    if (words.length <= left) {
      taken.push(segment);
      left -= words.length;
    } else {
      taken.push(rebuild(segment, left));
      left = 0;
    }
  }
  return { taken, left };
}

// Takes list items in order from a remaining word budget, mirroring takeInline's contract one
// level up: an item past the budget is dropped entirely rather than shown empty.
function takeListItems(items: Inline[][], budget: number): { taken: Inline[][]; left: number } {
  const taken: Inline[][] = [];
  let left = budget;
  for (const item of items) {
    if (left <= 0) break;
    const { taken: takenItem, left: remaining } = takeInline(item, left);
    if (takenItem.length > 0) taken.push(takenItem);
    left = remaining;
  }
  return { taken, left };
}

// Takes one block's content within a remaining word budget: list items for a list block, inline
// segments otherwise. Returns undefined in place of a block none of which fit, alongside the
// budget left after it - block and list share this same taken/left contract.
function takeBlock(block: Block, budget: number): { taken: Block | undefined; left: number } {
  if (block.kind === "list") {
    const { taken: items, left } = takeListItems(block.items, budget);
    return { taken: items.length > 0 ? { kind: "list", items } : undefined, left };
  }
  const { taken, left } = takeInline(block.content, budget);
  return { taken: taken.length > 0 ? { ...block, content: taken } : undefined, left };
}

/**
 * Reveals the first `words` words of `blocks`, in reading order: block content, list items,
 * inline segments each losing only their own trailing words. A block or item past the budget is
 * dropped entirely rather than shown empty. The same tags render throughout - only how much text
 * they hold changes, so streaming and completed content look identical (ADR-140).
 */
export function revealBlocks(blocks: Block[], words: number): Block[] {
  let left = Math.max(0, words);
  const revealed: Block[] = [];
  for (const block of blocks) {
    if (left <= 0) break;
    const { taken, left: remaining } = takeBlock(block, left);
    if (taken) revealed.push(taken);
    left = remaining;
  }
  return revealed;
}
