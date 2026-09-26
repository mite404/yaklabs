import type { Conversation, ConversationSummary } from "./protocol";

/**
 * Where the worker keeps conversations (ADR-086: save, list, search, read). The browser build
 * uses SQLite in the private file system; a desktop build adds one adapter for native SQLite.
 */
export interface ConversationStore {
  /** Reads one conversation, or `undefined` when the id has never been saved. */
  open(id: string): Promise<Conversation | undefined>;
  /** Writes the whole conversation over any earlier copy, so saving twice changes nothing. */
  save(conversation: Conversation): Promise<void>;
  /** Every conversation, newest first. */
  list(): Promise<ConversationSummary[]>;
  /**
   * Conversations holding a message that contains every word of `query`, newest first.
   * Words match as prefixes, ignoring case and accents; a query with no words finds nothing.
   */
  search(query: string): Promise<ConversationSummary[]>;
}

// The list shows one line of the latest message, cut at a word-ish length.
const PREVIEW_LENGTH = 80;

// A word is a run of letters and digits, the same split SQLite's unicode61 tokenizer makes.
const WORD_BREAK = /[^\p{L}\p{N}]+/u;
const ACCENT = /\p{M}/gu;

/** "Café, Sat." → ["cafe", "sat"]: words folded the way the full-text index folds its text. */
export function foldWords(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(ACCENT, "")
    .toLowerCase()
    .split(WORD_BREAK)
    .filter((word) => word !== "");
}

// The last message's text on one line, shortened with an ellipsis when it runs long.
function toPreview(text: string): string {
  const line = text.replaceAll(/\s+/g, " ").trim();
  return line.length <= PREVIEW_LENGTH ? line : `${line.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…`;
}

/** The list row for a conversation, given its latest message text (empty when it has none). */
export function toSummary(
  conversation: Pick<Conversation, "id" | "title" | "updatedAt">,
  lastText: string,
): ConversationSummary {
  const { id, title, updatedAt } = conversation;
  return { id, title, updatedAt, preview: toPreview(lastText) };
}

/** Newest first; the id breaks ties so the order never depends on insertion. */
export function newestFirst(a: ConversationSummary, b: ConversationSummary): number {
  return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
}

// True when every term starts some word of the text: the in-memory twin of an FTS5 prefix query.
function matchesAll(text: string, terms: string[]): boolean {
  const textWords = foldWords(text);
  return terms.every((term) => textWords.some((word) => word.startsWith(term)));
}

function summarize(conversation: Conversation): ConversationSummary {
  return toSummary(conversation, conversation.messages.at(-1)?.text ?? "");
}

/**
 * A store that lives only as long as the worker: for tests, and the fallback when the
 * browser's private file system is unavailable. It hands out copies, as a database would.
 */
export function createMemoryStore(): ConversationStore {
  const conversations = new Map<string, Conversation>();
  const all = () => [...conversations.values()]; // → Conversation[]

  return {
    open: (id) => {
      const stored = conversations.get(id); // → Conversation | undefined
      return Promise.resolve(stored && structuredClone(stored));
    },
    save: (conversation) => {
      conversations.set(conversation.id, structuredClone(conversation));
      return Promise.resolve();
    },
    list: () =>
      Promise.resolve(
        all()
          .map((each) => summarize(each))
          .toSorted(newestFirst),
      ),
    search: (query) => {
      const terms = foldWords(query); // → string[]
      const hits = all().filter(
        (conversation) =>
          terms.length > 0 &&
          conversation.messages.some((message) => matchesAll(message.text, terms)),
      );
      return Promise.resolve(hits.map((hit) => summarize(hit)).toSorted(newestFirst));
    },
  };
}
