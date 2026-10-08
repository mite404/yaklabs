import { resolve, selectionSchema, type Selection } from "@yaklabs/catalog/catalog";
import type { ThreadMessage } from "@yaklabs/catalog/thread";
import type { Command, Source } from "./protocol";
import type { Store } from "./store";
import type { Writer } from "./storeWrites";
import type { ThreadId } from "./workspace";

// An external agent's card (MCP), saved as one agent turn the thread labels as external.

type InsertCard = Extract<Command, { kind: "insertCard" }>;
type AgentTurn = Extract<ThreadMessage, { role: "agent" }>;
// What the turn shows: its words, and the card as the catalog will draw it.
type Shown = { text: string; payload: Selection };
// A turn an insertion already saved, and the thread it sits in.
type Saved = { threadId: ThreadId; turn: ThreadMessage };

// The turn's id, minted from the insertion's alone, so a retry finds the turn it saved.
const turnIdOf = (insertionId: string): string => `mcp:${insertionId}`;

// The card as the catalog resolves it: as it came, the exact values it falls back to with why,
// or an empty card the thread says has nothing to show. The words are the card's title, which
// the catalog's schema has already held to plain, bounded text.
function shownOf(card: Selection): Shown {
  const resolution = resolve(card); // → Resolution
  switch (resolution.kind) {
    case "approved":
      return { text: card.props.title, payload: resolution.selection };
    case "fallback":
      return { text: `${card.props.title} · ${resolution.reason}`, payload: resolution.selection };
    case "empty":
      return { text: resolution.title, payload: card };
    case "rejected":
      throw new Error(resolution.reason);
    default: {
      const unhandled: never = resolution;
      return unhandled;
    }
  }
}

// One card in one form, whatever order its keys came in: as the catalog's schema parses it.
const canonical = (payload: unknown): string | undefined => {
  const parsed = selectionSchema.safeParse(payload); // → { success, data } | { success, error }
  return parsed.success ? JSON.stringify(parsed.data) : undefined;
};

// Whether a saved turn shows exactly what `shown` would.
function shows(turn: ThreadMessage, shown: Shown): boolean {
  if (turn.role !== "agent" || turn.text !== shown.text) return false;
  const saved = canonical(turn.payload); // → string | undefined
  return saved !== undefined && saved === canonical(shown.payload);
}

// The turn saved under `id` in any thread the workspace shows, if one is.
function savedTurn(store: Store, id: string): Saved | undefined {
  for (const { id: threadId } of store.workspace().threads) {
    const turn = store.transcript(threadId)?.messages.find((message) => message.id === id);
    if (turn !== undefined) return { threadId, turn };
  }
  return undefined;
}

/**
 * Saves an external agent's card as one agent turn at the end of the thread, in one write: its
 * id and attribution minted from the insertion id, its card as the catalog resolves it, the
 * thread's draft and turns as they were. A retry with the same card changes nothing.
 * @param replying Whether the thread has a reply in flight or waiting, which the card must not
 *   cut into.
 * @throws For a scenario, which keeps nothing on the device; an unknown or deleted thread; an
 *   insertion id that already holds another card or sits in another thread; and a thread that
 *   is replying.
 */
export function insertCard(
  { store, mint, source }: Writer & { source: Source },
  { threadId, insertionId, card }: InsertCard,
  replying: boolean,
): void {
  if (source.kind !== "device") throw new Error("A scenario takes no external cards");
  if (!store.workspace().threads.some((thread) => thread.id === threadId))
    throw new Error(`No thread ${threadId}`);
  const id = turnIdOf(insertionId);
  const shown = shownOf(card); // → Shown
  const saved = savedTurn(store, id); // → Saved | undefined
  if (saved !== undefined) {
    if (saved.threadId === threadId && shows(saved.turn, shown)) return;
    throw new Error(`Insertion ${insertionId} already holds a different card`);
  }
  if (replying) throw new Error(`Thread ${threadId} is replying; insert the card once it is done`);
  const now = mint.now();
  const turn: AgentTurn = {
    id,
    role: "agent",
    text: shown.text,
    time: mint.turnTime(now),
    payload: shown.payload,
    external: { insertionId },
  };
  store.changeTranscript(threadId, (transcript) => ({
    ...transcript,
    messages: [...transcript.messages, turn],
    updatedAt: now.toISOString(),
  }));
}
