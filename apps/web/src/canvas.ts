import { cardFromDrop, type SharedCard } from "@yaklabs/catalog/share";

/** What lands on the canvas: a highlight from a thread, or a card dragged by its header. */
export type Drop = { kind: "text"; text: string } | { kind: "card"; card: SharedCard };

/** The part of a drag's data the canvas reads. */
export type DragData = Pick<DataTransfer, "types" | "getData">;

// Lanes closed by hand, kept out of the canvas on later visits; the conversations stay.
const HIDDEN_KEY = "kay.canvas.hidden";
const TITLE_LENGTH = 48;

/** Reads a drop: a card first, else the dragged text; undefined when it carried neither. */
export function readDrop(transfer: DragData): Drop | undefined {
  const card = cardFromDrop(transfer); // → SharedCard | undefined
  if (card) return { kind: "card", card };
  const text = transfer.getData("text/plain").trim();
  return text === "" ? undefined : { kind: "text", text };
}

/** Whether a drag in progress carries something the canvas takes. */
export function accepts(transfer: DragData): boolean {
  return transfer.types.includes("text/plain") || transfer.types.includes("application/x-kay-card");
}

/** A thread title from a highlight: its first line, cut at a word to fit a lane's header. */
export function titleFor(text: string): string {
  const line = text.replaceAll(/\s+/g, " ").trim();
  if (line.length <= TITLE_LENGTH) return line;
  const cut = line.slice(0, TITLE_LENGTH);
  const atWord = cut.lastIndexOf(" ");
  return `${(atWord > TITLE_LENGTH / 2 ? cut.slice(0, atWord) : cut).trimEnd()}…`;
}

/** The highlight as the opening draft: quoted, with room beneath it to ask. */
export function quoteFor(text: string): string {
  const quoted = text
    .trim()
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `${quoted}\n\n`;
}

/** A conversation id for a new lane, unlikely to collide even with two drops in one tick. */
export function laneId(now = Date.now()): string {
  return `thread-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** The ids of lanes the visitor closed. */
export function loadHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY); // → JSON array, or null
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/** Remembers a closed lane; a browser that refuses storage forgets it on the next visit. */
export function hide(id: string): void {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...loadHidden(), id]));
  } catch {
    // The lane still closes for this visit.
  }
}
