import type { ThreadMessage } from "./thread";

// How much of a request its bookmark shows: enough to tell requests apart at a glance.
const BOOKMARK_CHARS = 15;

/** One request the user sent, as its bookmark shows it. */
export type Request = { id: string; label: string; text: string; time: string };

/**
 * The first `BOOKMARK_CHARS` characters of a request, counted by code point so an emoji is
 * never cut in half, with an ellipsis when there was more.
 */
export function bookmarkLabel(text: string): string {
  const chars = Array.from(text.trim().replaceAll(/\s+/g, " ")); // → one entry per code point
  const head = chars.slice(0, BOOKMARK_CHARS).join("").trimEnd();
  return chars.length > BOOKMARK_CHARS ? `${head}…` : head;
}

/**
 * Every request the user sent in the thread, oldest first. An answer to a docked question is
 * not a request: the question asked it, so it is left out.
 */
export function requestsOf(messages: ThreadMessage[]): Request[] {
  return messages
    .filter((message) => message.role === "user" && message.question === undefined) // → requests
    .map(({ id, text, time }) => ({ id, label: bookmarkLabel(text), text, time }));
}

/**
 * The ids of the turns whose text holds `query`, in thread order, ignoring case. A blank query
 * matches nothing. Only a turn's own words are searched, not the cards it carries.
 */
export function matchesOf(messages: ThreadMessage[], query: string): string[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === "") return [];
  return messages
    .filter((message) => message.text.toLocaleLowerCase().includes(needle))
    .map((message) => message.id);
}

/**
 * The match one step from `current` in `direction`, wrapping at either end. With no current
 * match, forward lands on the first and back on the last.
 */
export function stepMatch(
  matches: string[],
  current: string | undefined,
  direction: 1 | -1,
): string | undefined {
  if (matches.length === 0) return undefined;
  const at = current === undefined ? -1 : matches.indexOf(current); // → -1 when gone
  if (at === -1) return direction === 1 ? matches[0] : matches.at(-1);
  return matches[(at + direction + matches.length) % matches.length];
}

/** What the search's counter says: how many turns match, and which one is showing. */
export function matchStatus(matches: string[], current?: string): string {
  if (matches.length === 0) return "No matches";
  const at = current === undefined ? -1 : matches.indexOf(current);
  if (at === -1) return matches.length === 1 ? "1 match" : `${matches.length} matches`;
  return `${at + 1} of ${matches.length}`;
}
