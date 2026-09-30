import type { Block, Inline } from "../demo/quiet-prose";
import { assertNever } from "./never";

// A source line, classified. A heading or list marker with nothing after it yet is kept
// empty, so a marker still streaming in shows nothing rather than a stray "#" or "-".
type Line =
  | { kind: "blank" }
  | { kind: "rule" }
  | { kind: "heading"; text: string }
  | { kind: "item"; text: string }
  | { kind: "text"; text: string; indented: boolean };

// The block being gathered while the lines fold: paragraph lines or list items.
type Open = { kind: "paragraph"; lines: string[] } | { kind: "list"; items: string[] } | null;
type Folding = { blocks: Block[]; open: Open };

// A span found at a position: what it shows and where the text after it starts.
type Token = { segment: Inline; end: number };

const HEADING = /^ {0,3}#{1,6}(?:\s+(.*))?$/;
const BULLET = /^ {0,3}[-*+](?:\s+(.*))?$/;
const NUMBERED = /^ {0,3}\d{1,9}[.)]\s+(.*)$/;
const RULE = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const SPECIAL = /[`*_[]/;
const WORD = /\w/;
const SPACE = /\s/;
const SAFE_SCHEMES = new Set(["https:", "mailto:"]);

const EMPTY: Folding = { blocks: [], open: null };

const text = (value: string): Inline => ({ kind: "text", text: value });

function classify(source: string): Line {
  if (source.trim() === "") return { kind: "blank" };
  if (RULE.test(source)) return { kind: "rule" };
  const heading = HEADING.exec(source);
  if (heading) return { kind: "heading", text: (heading.at(1) ?? "").trim() };
  const item = BULLET.exec(source) ?? NUMBERED.exec(source);
  if (item) return { kind: "item", text: (item.at(1) ?? "").trim() };
  return { kind: "text", text: source.trim(), indented: /^\s/.test(source) };
}

// Only https and mailto links are kept; any other scheme, or no scheme, stays plain text.
function safeHref(url: string): string | undefined {
  try {
    return SAFE_SCHEMES.has(new URL(url).protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}

// The words inside a span, with any markers nested in it dropped: Quiet prose is flat.
function plainText(source: string): string {
  return parseInline(source)
    .map((segment) => segment.text)
    .join("");
}

function readCode(source: string, at: number): Token | undefined {
  if (source[at] !== "`") return undefined;
  const close = source.indexOf("`", at + 1);
  if (close === -1)
    return { segment: { kind: "code", text: source.slice(at + 1) }, end: source.length };
  return { segment: { kind: "code", text: source.slice(at + 1, close) }, end: close + 1 };
}

function readStrong(source: string, at: number): Token | undefined {
  if (!source.startsWith("**", at)) return undefined;
  if (SPACE.test(source.charAt(at + 2))) return undefined;
  const close = source.indexOf("**", at + 2);
  const inner = close === -1 ? source.slice(at + 2) : source.slice(at + 2, close);
  const end = close === -1 ? source.length : close + 2;
  return { segment: { kind: "strong", text: plainText(inner) }, end };
}

// A closing `*` or `_` touches the word before it; a closing `_` also ends a word.
function emphasisClose(source: string, marker: string, from: number): number {
  for (let at = source.indexOf(marker, from); at !== -1; at = source.indexOf(marker, at + 1)) {
    const before = source.charAt(at - 1);
    const after = source.charAt(at + 1);
    if (!SPACE.test(before) && (marker === "*" || !WORD.test(after))) return at;
  }
  return -1;
}

// `*x*` or `_x_`. An opener must touch the word after it, and `_` must start a word, so
// "2 * 3" and snake_case stay text. A marker at the very end is hidden while more streams in.
function readEmphasis(source: string, at: number): Token | undefined {
  const marker = source.charAt(at);
  if (marker !== "*" && marker !== "_") return undefined;
  const after = source.charAt(at + 1);
  if (after === "") return { segment: text(""), end: at + 1 };
  const openerTouchesWord = WORD.test(source.charAt(at - 1));
  if (SPACE.test(after) || (marker === "_" && openerTouchesWord)) return undefined;
  const close = emphasisClose(source, marker, at + 1);
  if (close === -1 && openerTouchesWord) return undefined;
  const inner = close === -1 ? source.slice(at + 1) : source.slice(at + 1, close);
  const end = close === -1 ? source.length : close + 1;
  return { segment: { kind: "em", text: plainText(inner) }, end };
}

// `[text](url)`. Until the url closes, only the text shows; a finished link with an unsafe
// url shows its text alone. A bracket not followed by "(" is ordinary text.
function readLink(source: string, at: number): Token | undefined {
  if (source[at] !== "[") return undefined;
  const bracket = source.indexOf("]", at + 1);
  if (bracket === -1) return { segment: text(plainText(source.slice(at + 1))), end: source.length };
  if (source[bracket + 1] !== "(") return undefined;
  const label = plainText(source.slice(at + 1, bracket));
  const paren = source.indexOf(")", bracket + 2);
  if (paren === -1) return { segment: text(label), end: source.length };
  const href = safeHref(source.slice(bracket + 2, paren).trim());
  const segment: Inline = href === undefined ? text(label) : { kind: "link", text: label, href };
  return { segment, end: paren + 1 };
}

// Ordinary text up to the next character that could open a span.
function readText(source: string, at: number): Token {
  const next = source.slice(at + 1).search(SPECIAL);
  const end = next === -1 ? source.length : at + 1 + next;
  return { segment: text(source.slice(at, end)), end };
}

function readAt(source: string, at: number): Token {
  return (
    readCode(source, at) ??
    readStrong(source, at) ??
    readEmphasis(source, at) ??
    readLink(source, at) ??
    readText(source, at)
  );
}

// Empty spans vanish and neighbouring text joins, so the tree stays small and stable.
function tidy(segments: Inline[]): Inline[] {
  const kept: Inline[] = [];
  for (const segment of segments) {
    const last = kept.at(-1);
    if (segment.text === "") continue;
    if (last?.kind === "text" && segment.kind === "text")
      kept[kept.length - 1] = text(last.text + segment.text);
    else kept.push(segment);
  }
  return kept;
}

function parseInline(source: string): Inline[] {
  const segments: Inline[] = [];
  for (let at = 0; at < source.length;) {
    const token = readAt(source, at);
    segments.push(token.segment);
    at = token.end;
  }
  return tidy(segments);
}

function closeBlock(blocks: Block[], open: Open): Block[] {
  if (open === null) return blocks;
  if (open.kind === "list") {
    const items = open.items.map((item) => parseInline(item)).filter((item) => item.length > 0);
    return items.length === 0 ? blocks : [...blocks, { kind: "list", items }];
  }
  const content = parseInline(open.lines.join(" "));
  return content.length === 0 ? blocks : [...blocks, { kind: "paragraph", content }];
}

// Folds one line into the blocks so far and the block still open.
function fold(state: Folding, line: Line): Folding {
  const { blocks, open } = state;
  switch (line.kind) {
    case "blank":
    case "rule":
      return { blocks: closeBlock(blocks, open), open: null };
    case "heading": {
      const content = parseInline(line.text);
      const closed = closeBlock(blocks, open);
      return {
        blocks: content.length === 0 ? closed : [...closed, { kind: "heading", content }],
        open: null,
      };
    }
    case "item":
      if (open?.kind === "list")
        return { blocks, open: { kind: "list", items: [...open.items, line.text] } };
      return { blocks: closeBlock(blocks, open), open: { kind: "list", items: [line.text] } };
    case "text":
      if (open?.kind === "paragraph")
        return { blocks, open: { kind: "paragraph", lines: [...open.lines, line.text] } };
      if (open?.kind === "list" && line.indented) {
        const items = [...open.items.slice(0, -1), `${open.items.at(-1) ?? ""} ${line.text}`];
        return { blocks, open: { kind: "list", items } };
      }
      return { blocks: closeBlock(blocks, open), open: { kind: "paragraph", lines: [line.text] } };
    default:
      return assertNever(line);
  }
}

/**
 * Parses a reply's markdown into Quiet prose blocks (ADR-140), tolerating a source that is
 * still streaming in: an unclosed `**`, `*`, `_` or backtick shows as its kind with the
 * marker hidden, and a link shows only its text until its url closes. Headings of any level,
 * `-`, `*` and numbered lists, and paragraphs split on blank lines. Never throws.
 */
export function parseQuietProse(source: string): Block[] {
  const lines = source.split(/\r?\n/).map((line) => classify(line)); // → Line[]
  const folded = lines.reduce((state, line) => fold(state, line), EMPTY); // → Folding
  return closeBlock(folded.blocks, folded.open); // → Block[]
}
