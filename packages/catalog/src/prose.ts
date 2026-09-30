// Quiet prose (ADR-140): the app-owned response contract. An agent or a script supplies
// paragraphs, lists, headings, emphasis and cards; the app owns how they look. No Markdown is
// parsed here, so a half-arrived delimiter can never show.

import { z } from "zod";

/** How a run of text is set: semibold for findings and asks, italic for asides, mono for code. */
export type Mark = "strong" | "em" | "code";

/** One run of inline text, or a link. */
export type Inline =
  | { kind: "run"; text: string; mark?: Mark }
  | { kind: "link"; text: string; href: string };

/** One block of a response: prose, a heading, a list, or a catalog card between paragraphs. */
export type Block =
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "heading"; content: Inline[] }
  | { kind: "list"; items: Inline[][] }
  | { kind: "card"; payload: unknown };

/** Parses a `Mark`. */
export const markSchema = z.enum(["strong", "em", "code"]);

const inlineSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("run"), text: z.string(), mark: markSchema.optional() }),
  z.object({ kind: z.literal("link"), text: z.string(), href: z.string() }),
]);

/**
 * Parses a `Block` where one crosses a boundary (the worker's protocol, the store). A card's
 * payload stays unknown: the catalog checks it as it renders.
 */
export const blockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("paragraph"), content: z.array(inlineSchema) }),
  z.object({ kind: z.literal("heading"), content: z.array(inlineSchema) }),
  z.object({ kind: z.literal("list"), items: z.array(z.array(inlineSchema)) }),
  z.object({ kind: z.literal("card"), payload: z.unknown() }),
]);

/** A plain run of text. */
export const text = (value: string): Inline => ({ kind: "run", text: value });
/** A semibold run: a finding, a decision, an ask. */
export const strong = (value: string): Inline => ({ kind: "run", text: value, mark: "strong" });
/** An italic run: an aside or a caveat. */
export const em = (value: string): Inline => ({ kind: "run", text: value, mark: "em" });
/** A run of code, revealed whole. */
export const code = (value: string): Inline => ({ kind: "run", text: value, mark: "code" });
/** A link. */
export const link = (value: string, href: string): Inline => ({ kind: "link", text: value, href });

export const paragraph = (content: Inline[]): Block => ({ kind: "paragraph", content });
export const heading = (content: Inline[]): Block => ({ kind: "heading", content });
export const list = (items: Inline[][]): Block => ({ kind: "list", items });
export const card = (payload: unknown): Block => ({ kind: "card", payload });

function inlineText(content: Inline[]): string {
  return content.map((segment) => segment.text).join("");
}

/**
 * The words of `blocks` as one string, paragraphs and items a line apart, cards left out: what a
 * search reads and what a plain-text host shows.
 */
export function plainText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      if (block.kind === "card") return "";
      if (block.kind === "list") return block.items.map(inlineText).join("\n");
      return inlineText(block.content);
    })
    .filter((line) => line !== "")
    .join("\n");
}
