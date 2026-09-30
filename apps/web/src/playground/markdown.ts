import type { Block, Inline } from "../demo/quiet-prose";

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
// Reads the span a marker opens at `at`, or declines so the next reader can try.
type Reader = (source: string, at: number) => Token | undefined;

type LineOf = { [L in Line as L["kind"]]: L };
type Folds = { [K in keyof LineOf]: (state: Folding, line: LineOf[K]) => Folding };

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

// The text between an opener and its closer. With no closer yet the span runs to the end,
// since the rest may still be streaming in.
function enclosed(
  source: string,
  from: number,
  close: number,
  width: number,
): { inner: string; end: number } {
  if (close === -1) return { inner: source.slice(from), end: source.length };
  return { inner: source.slice(from, close), end: close + width };
}

function readCode(source: string, at: number): Token {
  const close = source.indexOf("`", at + 1);
  const { inner, end } = enclosed(source, at + 1, close, 1);
  return { segment: { kind: "code", text: inner }, end };
}

function readStrong(source: string, at: number): Token | undefined {
  if (!source.startsWith("**", at)) return undefined;
  if (SPACE.test(source.charAt(at + 2))) return undefined;
  const close = source.indexOf("**", at + 2);
  const { inner, end } = enclosed(source, at + 2, close, 2);
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

// An opener must touch the word after it, and `_` must start a word, so "2 * 3" and
// snake_case stay text.
function opensEmphasis(source: string, at: number): boolean {
  if (SPACE.test(source.charAt(at + 1))) return false;
  return source.charAt(at) === "*" || !WORD.test(source.charAt(at - 1));
}

// `*x*` or `_x_`. A marker at the very end is hidden while more streams in; an opener glued to
// the word before it needs its closer before it counts.
function readEmphasis(source: string, at: number): Token | undefined {
  if (at + 1 === source.length) return { segment: text(""), end: at + 1 };
  if (!opensEmphasis(source, at)) return undefined;
  const close = emphasisClose(source, source.charAt(at), at + 1);
  if (close === -1 && WORD.test(source.charAt(at - 1))) return undefined;
  const { inner, end } = enclosed(source, at + 1, close, 1);
  return { segment: { kind: "em", text: plainText(inner) }, end };
}

// `[text](url)`. Until the url closes, only the text shows; a finished link with an unsafe
// url shows its text alone. A bracket not followed by "(" is ordinary text.
function readLink(source: string, at: number): Token | undefined {
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

// The readers each marker can open, in the order they try; `**` is strong before `*` is em.
// Keep the keys in step with SPECIAL, which is where plain text stops to look.
const READERS: Partial<Record<string, readonly Reader[]>> = {
  "`": [readCode],
  "*": [readStrong, readEmphasis],
  _: [readEmphasis],
  "[": [readLink],
};

function readAt(source: string, at: number): Token {
  const readers = READERS[source.charAt(at)] ?? []; // → Reader[]
  for (const read of readers) {
    const token = read(source, at);
    if (token !== undefined) return token;
  }
  return readText(source, at);
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

// A blank line or a rule ends whatever block is open.
function foldBreak({ blocks, open }: Folding): Folding {
  return { blocks: closeBlock(blocks, open), open: null };
}

// A heading stands alone; one with no words yet adds nothing.
function foldHeading({ blocks, open }: Folding, line: LineOf["heading"]): Folding {
  const content = parseInline(line.text);
  const closed = closeBlock(blocks, open);
  return {
    blocks: content.length === 0 ? closed : [...closed, { kind: "heading", content }],
    open: null,
  };
}

// An item joins the open list, or closes what is open and starts one.
function foldItem({ blocks, open }: Folding, line: LineOf["item"]): Folding {
  if (open?.kind === "list")
    return { blocks, open: { kind: "list", items: [...open.items, line.text] } };
  return { blocks: closeBlock(blocks, open), open: { kind: "list", items: [line.text] } };
}

// Text continues an open paragraph, or an indented line continues the last list item;
// anything else starts a paragraph.
function foldText({ blocks, open }: Folding, line: LineOf["text"]): Folding {
  if (open?.kind === "paragraph")
    return { blocks, open: { kind: "paragraph", lines: [...open.lines, line.text] } };
  if (open?.kind === "list" && line.indented) {
    const items = [...open.items.slice(0, -1), `${open.items.at(-1) ?? ""} ${line.text}`];
    return { blocks, open: { kind: "list", items } };
  }
  return { blocks: closeBlock(blocks, open), open: { kind: "paragraph", lines: [line.text] } };
}

const FOLDS: Folds = {
  blank: foldBreak,
  rule: foldBreak,
  heading: foldHeading,
  item: foldItem,
  text: foldText,
};

// Folds one line into the blocks so far and the block still open. `kind` travels beside
// `line` so the lookup and the handler's input stay paired.
function fold<K extends keyof LineOf>(state: Folding, kind: K, line: LineOf[K]): Folding {
  return FOLDS[kind](state, line);
}

/**
 * Parses a reply's markdown into Quiet prose blocks (ADR-140), tolerating a source that is
 * still streaming in: an unclosed `**`, `*`, `_` or backtick shows as its kind with the
 * marker hidden, and a link shows only its text until its url closes. Headings of any level,
 * `-`, `*` and numbered lists, and paragraphs split on blank lines. Never throws.
 */
export function parseQuietProse(source: string): Block[] {
  const lines = source.split(/\r?\n/).map((line) => classify(line)); // → Line[]
  const folded = lines.reduce((state, line) => fold(state, line.kind, line), EMPTY); // → Folding
  return closeBlock(folded.blocks, folded.open); // → Block[]
}
