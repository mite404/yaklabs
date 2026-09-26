/** A single card, shared on its own: the kind of card and the agent's payload for it. */
export type SharedCard = { v: 1; kind: "catalog" | "interactive"; payload: unknown };

// The link's fragment: everything after `#c=` is the card. Fragments never reach a server,
// so the card's data stays between the people who have the link.
const PREFIX = "c=";

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
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
    const card = JSON.parse(fromBase64Url(fragment.slice(PREFIX.length)));
    if (card?.v !== 1 || (card.kind !== "catalog" && card.kind !== "interactive")) return undefined;
    return card as SharedCard;
  } catch {
    return undefined;
  }
}

/**
 * The public link for one card (ADR-064): the standalone share page with the card in its
 * fragment. Inside Storybook it points at the Share/Public page story, so it works there
 * and in a published Storybook; in the app it points at share.html beside the app.
 */
export function shareLink(card: SharedCard, at: Location = window.location): string {
  const fragment = encodeCard(card);
  if (at.pathname.endsWith("/iframe.html"))
    return `${at.origin}${at.pathname}?id=share-public-page--from-link&viewMode=story#${fragment}`;
  return `${new URL("share.html", at.href).href.split("#")[0]}#${fragment}`;
}
