import { z } from "zod";

// The envelope a link carries. The payload stays opaque here: the card's own catalog check
// validates it before anything renders (ADR-064).
const sharedCardSchema = z.object({
  v: z.literal(1),
  kind: z.enum(["catalog", "interactive"]),
  payload: z.unknown(),
});

/** A single card, shared on its own: the kind of card and the agent's payload for it. */
export type SharedCard = z.infer<typeof sharedCardSchema>;

/** The type under which a dragged card rides on the drag's data (ADR-089). */
export const CARD_DRAG_TYPE = "application/x-kay-card";

/** Puts a card on a drag, with its title as the plain text a foreign drop target would see. */
export function startCardDrag(transfer: DataTransfer, card: SharedCard, title: string): void {
  transfer.setData(CARD_DRAG_TYPE, JSON.stringify(card));
  transfer.setData("text/plain", title);
  transfer.effectAllowed = "copy";
}

/** The card a drop carries, or undefined when the drag was something else, such as text. */
export function cardFromDrop(transfer: Pick<DataTransfer, "getData">): SharedCard | undefined {
  const raw = transfer.getData(CARD_DRAG_TYPE); // → JSON, or "" when no card was dragged
  if (raw === "") return undefined;
  try {
    const parsed = sharedCardSchema.safeParse(JSON.parse(raw)); // → SharedCard, or a failure
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

// The parts of a location a share link is built from.
type LinkBase = Pick<Location, "href" | "pathname" | "origin">;

// The link's fragment: everything after `#c=` is the card. Fragments never reach a server,
// so the card's data stays between the people who have the link.
const PREFIX = "c=";

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** Encodes a card for a link's fragment. */
export function encodeCard(card: SharedCard): string {
  return PREFIX + toBase64Url(JSON.stringify(card));
}

/**
 * Reads a card back from a link's fragment. Anything malformed returns undefined; the
 * card's own catalog check still validates the payload before anything renders (ADR-064).
 */
export function decodeCard(hash: string): SharedCard | undefined {
  const fragment = hash.replace(/^#/, "");
  if (!fragment.startsWith(PREFIX)) return undefined;
  try {
    const json: unknown = JSON.parse(fromBase64Url(fragment.slice(PREFIX.length))); // → unknown
    const card = sharedCardSchema.safeParse(json); // → SharedCard, or why it is not one
    return card.success ? card.data : undefined;
  } catch {
    // Not base64 or not JSON: a garbled link.
    return undefined;
  }
}

/**
 * The public link for one card (ADR-064): the standalone share page with the card in its
 * fragment. Inside Storybook it points at the Share/Public page story, so it works there
 * and in a published Storybook; in the app it points at share.html beside the app.
 */
export function shareLink(card: SharedCard, at: LinkBase = window.location): string {
  const fragment = encodeCard(card);
  if (at.pathname.endsWith("/iframe.html"))
    return `${at.origin}${at.pathname}?id=share-public-page--from-link&viewMode=story#${fragment}`;
  return `${new URL("share.html", at.href).href.split("#")[0]}#${fragment}`;
}
