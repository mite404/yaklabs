import sqlite3InitModule, {
  type BindingSpec,
  type Database,
  type SqlValue,
  type Sqlite3Static,
} from "@sqlite.org/sqlite-wasm";
import type { ThreadMessage } from "@yaklabs/catalog/thread";
import { z } from "zod";
import { threadMessageSchema, type Conversation, type ConversationSummary } from "./protocol";
import { foldWords, newestFirst, toSummary, type ConversationStore } from "./store";

/**
 * Where the database lives: a named file in the browser's private file system (ADR-081; only
 * inside a Worker), or memory (node and tests).
 */
export type StoreLocation = { kind: "opfs"; name: string } | { kind: "memory" };

/** A SQLite-backed store; close it before opening the same file again elsewhere. */
export type SqliteStore = ConversationStore & { close(): void };

// Names become an OPFS directory and a file, so they stay plain.
const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

// Rows hold what every turn has; `extra_json` holds the rest (its id, chips, files and cards).
// The full-text index is an external-content FTS5 table kept in step by triggers, so it can
// never disagree with the rows it indexes.
const SCHEMA = `
  pragma foreign_keys = on;
  create table if not exists conversations (
    id text primary key,
    title text not null,
    updated_at text not null
  );
  create table if not exists messages (
    conversation_id text not null references conversations (id) on delete cascade,
    seq integer not null,
    role text not null check (role in ('user', 'agent')),
    text text not null,
    time text not null,
    extra_json text not null,
    primary key (conversation_id, seq)
  );
  create virtual table if not exists messages_fts using fts5 (
    text, content = 'messages', content_rowid = 'rowid'
  );
  create trigger if not exists messages_fts_insert after insert on messages begin
    insert into messages_fts (rowid, text) values (new.rowid, new.text);
  end;
  create trigger if not exists messages_fts_delete after delete on messages begin
    insert into messages_fts (messages_fts, rowid, text) values ('delete', old.rowid, old.text);
  end;
  create trigger if not exists messages_fts_update after update on messages begin
    insert into messages_fts (messages_fts, rowid, text) values ('delete', old.rowid, old.text);
    insert into messages_fts (rowid, text) values (new.rowid, new.text);
  end;
  pragma user_version = 1;
`;

const UPSERT_CONVERSATION = `
  insert into conversations (id, title, updated_at) values (?, ?, ?)
  on conflict (id) do update set title = excluded.title, updated_at = excluded.updated_at
`;
const INSERT_MESSAGE = `
  insert into messages (conversation_id, seq, role, text, time, extra_json)
  values (?, ?, ?, ?, ?, ?)
`;
// One row per conversation, with the text of its latest message for the preview.
const SUMMARIES = `
  select c.id, c.title, c.updated_at,
    coalesce((select m.text from messages m where m.conversation_id = c.id
              order by m.seq desc limit 1), '') as last_text
  from conversations c
`;
const MATCHING = `
  where c.id in (select m.conversation_id from messages_fts f
                 join messages m on m.rowid = f.rowid
                 where messages_fts match ?)
`;

// What SQLite hands back, checked before it becomes a domain type.
const conversationRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  updated_at: z.string(),
});
const summaryRowSchema = conversationRowSchema.extend({ last_text: z.string() });
const messageRowSchema = z.object({
  role: z.string(),
  text: z.string(),
  time: z.string(),
  extra_json: z.string(),
});
const extraSchema = z.record(z.string(), z.unknown());

// The wasm module loads once per worker; later stores reuse it and its registered VFS.
let sqlite3: Promise<Sqlite3Static> | undefined;

// SQLite's calls are synchronous; this keeps a thrown error a rejection, as a caller expects.
function settle<T>(work: () => T): Promise<T> {
  return new Promise((resolve) => {
    resolve(work());
  });
}

function toMessageRow(conversationId: string, seq: number, message: ThreadMessage): BindingSpec {
  const { role, text, time, ...extra } = message;
  return [conversationId, seq, role, text, time, JSON.stringify(extra)];
}

function fromMessageRow(row: Record<string, SqlValue>): ThreadMessage {
  const { role, text, time, extra_json } = messageRowSchema.parse(row);
  const extra = extraSchema.parse(JSON.parse(extra_json)); // → Record<string, unknown>
  return threadMessageSchema.parse({ ...extra, role, text, time });
}

function fromSummaryRow(row: Record<string, SqlValue>): ConversationSummary {
  const { id, title, updated_at, last_text } = summaryRowSchema.parse(row);
  return toSummary({ id, title, updatedAt: updated_at }, last_text);
}

// ["sat", "net"] → `"sat"* "net"*`: every word, as a prefix. Folded words hold only letters
// and digits, so quoting them needs no escaping.
function toMatchQuery(terms: string[]): string {
  return terms.map((term) => `"${term}"*`).join(" ");
}

function writeConversation(db: Database, conversation: Conversation): void {
  const { id, title, updatedAt, messages } = conversation;
  db.transaction((tx) => {
    tx.exec({ sql: UPSERT_CONVERSATION, bind: [id, title, updatedAt] });
    tx.exec({ sql: "delete from messages where conversation_id = ?", bind: [id] });
    const insert = tx.prepare(INSERT_MESSAGE);
    try {
      for (const [seq, message] of messages.entries()) {
        insert.bind(toMessageRow(id, seq, message)).stepReset();
      }
    } finally {
      insert.finalize();
    }
  });
}

function readConversation(db: Database, id: string): Conversation | undefined {
  const row = db.selectObject("select id, title, updated_at from conversations where id = ?", [id]);
  if (row === undefined) return undefined;
  const { title, updated_at } = conversationRowSchema.parse(row);
  const messages = db
    .selectObjects(
      "select role, text, time, extra_json from messages where conversation_id = ? order by seq",
      [id],
    )
    .map((message) => fromMessageRow(message)); // → ThreadMessage[]
  return { id, title, updatedAt: updated_at, messages };
}

function readSummaries(db: Database, query?: string): ConversationSummary[] {
  const rows =
    query === undefined
      ? db.selectObjects(SUMMARIES)
      : db.selectObjects(`${SUMMARIES} ${MATCHING}`, [query]); // → Record<string, SqlValue>[]
  return rows.map((row) => fromSummaryRow(row)).toSorted(newestFirst);
}

async function openDatabase(location: StoreLocation): Promise<Database> {
  const api = await (sqlite3 ??= sqlite3InitModule()); // → Sqlite3Static
  if (location.kind === "memory") return new api.oo1.DB(":memory:", "c");
  if (!NAME.test(location.name)) throw new Error(`Unusable store name: ${location.name}`);
  // One pool per database, so two databases (or two test files) never share a directory.
  const pool = await api.installOpfsSAHPoolVfs({ name: `opfs-sahpool-${location.name}` });
  return new pool.OpfsSAHPoolDb(`/${location.name}.sqlite3`);
}

/**
 * Opens (creating when new) a conversation store in SQLite (ADR-081). In the browser it uses
 * the `opfs-sahpool` VFS, which needs no cross-origin isolation headers but works only inside
 * a Worker; in node only `memory` works.
 *
 * @throws When the name is not lowercase letters, digits and dashes, when the private file
 *   system or its access handles are unavailable (outside a Worker, or another worker holds
 *   the pool), or when the database cannot be opened.
 */
export async function openSqliteStore(location: StoreLocation): Promise<SqliteStore> {
  const db = await openDatabase(location);
  db.exec(SCHEMA);

  return {
    open: (id) => settle(() => readConversation(db, id)),
    save: (conversation) =>
      settle(() => {
        writeConversation(db, conversation);
      }),
    list: () => settle(() => readSummaries(db)),
    search: (query) => {
      const terms = foldWords(query); // → string[]
      return settle(() => (terms.length === 0 ? [] : readSummaries(db, toMatchQuery(terms))));
    },
    close: () => {
      db.close();
    },
  };
}
