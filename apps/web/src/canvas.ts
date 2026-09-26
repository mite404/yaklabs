import { cardFromDrop, type SharedCard } from "@yaklabs/catalog/share";

/**
 * What lands on the canvas: a highlight from a thread, or a card dragged by its header, which
 * brings its title along as the plain text of the drag.
 */
export type Drop =
  | { kind: "text"; text: string }
  | { kind: "card"; card: SharedCard; title: string };

/** The part of a drag's data the canvas reads. */
export type DragData = Pick<DataTransfer, "types" | "getData">;

/** Where a lane sits along the row and how wide it is, in the row's own px. */
export type Slot = { left: number; width: number };

// Lanes closed by hand, kept out of the canvas on later visits; the conversations stay. The
// order lanes were left in lives beside it.
const HIDDEN_KEY = "kay.canvas.hidden";
const ORDER_KEY = "kay.canvas.order";
const TITLE_LENGTH = 48;

function centre(slot: Slot): number {
  return slot.left + slot.width / 2;
}

/**
 * The index a lane dragged `dx` px from `from` would land at: it passes a neighbour once its
 * centre crosses the neighbour's, and not before.
 */
export function landingIndex(slots: Slot[], from: number, dx: number): number {
  const dragged = centre(slots[from]) + dx;
  let to = from;
  for (let i = from + 1; i < slots.length; i++) if (dragged > centre(slots[i])) to = i;
  for (let i = from - 1; i >= 0; i--) if (dragged < centre(slots[i])) to = i;
  return to;
}

/** How far lane `i` steps aside, in px, while the lane at `from` is on its way to `to`. */
export function shiftFor(slots: Slot[], from: number, to: number, i: number, gap: number): number {
  const room = slots[from].width + gap;
  if (from < i && i <= to) return -room;
  if (to <= i && i < from) return room;
  return 0;
}

/** The left edge of the slot the lane at `from` will land in at `to`. */
export function slotLeft(slots: Slot[], from: number, to: number): number {
  const target = slots[to];
  return to > from ? target.left + target.width - slots[from].width : target.left;
}

/** The items with the one at `from` moved to `to`. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const moved = [...items];
  const [item] = moved.splice(from, 1);
  moved.splice(to, 0, item);
  return moved;
}

/** The items in the saved order, with any it does not name after them in their own order. */
export function sortByOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  const rank = new Map(order.map((id, index) => [id, index])); // → id → position
  const named = items.filter((item) => rank.has(item.id));
  const unnamed = items.filter((item) => !rank.has(item.id));
  named.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  return [...named, ...unnamed];
}

/** Reads a drop: a card first, else the dragged text; undefined when it carried neither. */
export function readDrop(transfer: DragData): Drop | undefined {
  const card = cardFromDrop(transfer); // → SharedCard | undefined
  const text = transfer.getData("text/plain").trim();
  if (card) return { kind: "card", card, title: text === "" ? "Card" : text };
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

// A list of ids stored under `key`; nothing when the browser refuses storage or it is not one.
function loadIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key); // → JSON array, or null
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** The ids of lanes the visitor closed. */
export function loadHidden(): Set<string> {
  return new Set(loadIds(HIDDEN_KEY));
}

/** The order the visitor left the thread lanes in. */
export function loadOrder(): string[] {
  return loadIds(ORDER_KEY);
}

/** Remembers the order of the thread lanes; a browser that refuses storage forgets it. */
export function saveOrder(ids: string[]): void {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
  } catch {
    // The lanes stay in this order for the visit.
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
