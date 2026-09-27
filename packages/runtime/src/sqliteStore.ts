import sqlite3InitModule, {
  type BindingSpec,
  type Database,
  type Sqlite3Static,
} from "@sqlite.org/sqlite-wasm";
import type { ThreadMessage } from "@yaklabs/catalog/thread";
import type { Transcript } from "./conversation";
import type { LegacyCanvas, RenameTarget } from "./protocol";
import { migrate, writeLanes } from "./schema";
import { matchQuery, newestFirst } from "./search";
import { readTranscript, readWorkspace } from "./sqliteRead";
import type { NewThread, Store } from "./store";
import {
  insertLane,
  lanesOf,
  threadLane,
  type Lane,
  type ThreadId,
  type ThreadSummary,
} from "./workspace";

/**
 * Where the database lives: a named file in the browser's private file system (ADR-081; only
 * inside a Worker), or memory (node, tests, scenarios, and the fallback when OPFS is refused).
 */
export type StoreLocation = { kind: "opfs"; name: string } | { kind: "memory" };

/**
 * The browser refused the private file system: outside a Worker, or another worker holds its
 * access handles. The one failure a device may answer by keeping its threads in memory.
 */
export class StorageUnavailableError extends Error {}

// Names become an OPFS directory and a file, so they stay plain.
const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

const MATCHING = `
  select distinct m.conversation_id from messages_fts f join messages m on m.rowid = f.rowid
  where messages_fts match ?
`;
const INSERT_THREAD = `
  insert into conversations (id, title, created_at, updated_at, project_id, parent_id, draft)
  values (?, ?, ?, ?, ?, ?, ?)
`;
const INSERT_MESSAGE = `
  insert into messages (conversation_id, seq, role, text, time, extra_json)
  values (?, ?, ?, ?, ?, ?)
`;
const RENAME: Record<RenameTarget["kind"], string> = {
  project: "update projects set name = ? where id = ?",
  thread: "update conversations set title = ? where id = ?",
};
const SAVE_SHELL = `
  insert into shell (id, json) values (1, ?) on conflict (id) do update set json = excluded.json
`;

// The wasm module loads once per worker; later stores reuse it and its registered VFS.
let sqlite3: Promise<Sqlite3Static> | undefined;

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toMessageRow(threadId: ThreadId, seq: number, message: ThreadMessage): BindingSpec {
  const { role, text, time, ...extra } = message;
  return [threadId, seq, role, text, time, JSON.stringify(extra)];
}

function writeMessages(db: Database, id: ThreadId, messages: ThreadMessage[]): void {
  db.exec({ sql: "delete from messages where conversation_id = ?", bind: [id] });
  const insert = db.prepare(INSERT_MESSAGE);
  try {
    for (const [seq, message] of messages.entries()) {
      insert.bind(toMessageRow(id, seq, message)).stepReset();
    }
  } finally {
    insert.finalize();
  }
}

function addThread(db: Database, thread: NewThread, laneAt: number | undefined): void {
  const { id, title, place, createdAt, updatedAt, draft, messages } = thread;
  const projectId = place.kind === "main" ? place.projectId : null;
  const parentId = place.kind === "child" ? place.parentId : null;
  db.exec({
    sql: INSERT_THREAD,
    bind: [id, title, createdAt, updatedAt, projectId, parentId, draft],
  });
  writeMessages(db, id, messages);
  if (laneAt === undefined) return;
  if (parentId === null) throw new Error(`${id} is a main thread, so it has no lane`);
  const lanes = lanesOf(readWorkspace(db), parentId);
  writeLanes(db, parentId, insertLane(lanes, laneAt, threadLane(id)));
}

function changeTranscript(
  db: Database,
  id: ThreadId,
  change: (transcript: Transcript) => Transcript,
): void {
  const current = readTranscript(db, id);
  if (current === undefined) throw new Error(`No thread ${id}`);
  const { messages, draft, updatedAt } = change(current);
  db.exec({
    sql: "update conversations set updated_at = ?, draft = ? where id = ?",
    bind: [updatedAt, draft, id],
  });
  writeMessages(db, id, messages);
}

function rename(db: Database, target: RenameTarget, name: string): void {
  db.exec({ sql: RENAME[target.kind], bind: [name, target.id] });
  if (db.changes() === 0) throw new Error(`No ${target.kind} ${target.id}`);
}

function arrange(db: Database, mainId: ThreadId, lanes: Lane[]): void {
  const row = db.selectObject("select parent_id from conversations where id = ?", [mainId]);
  if (row === undefined) throw new Error(`No thread ${mainId}`);
  if (row.parent_id !== null) throw new Error(`${mainId} is a sub-thread, so it has no canvas`);
  writeLanes(db, mainId, lanes);
}

function search(db: Database, query: string): ThreadSummary[] {
  const match = matchQuery(query); // → FTS5 query, or undefined with no words
  if (match === undefined) return [];
  const hits = new Set(db.selectValues(MATCHING, [match]));
  return readWorkspace(db)
    .threads.filter((thread) => hits.has(thread.id))
    .toSorted(newestFirst);
}

/**
 * Opens the database file itself, with no schema applied: a named file in the private file
 * system (only inside a Worker), or memory.
 *
 * @throws A `StorageUnavailableError` when the private file system is refused; an `Error` when
 *   the name is not lowercase letters, digits and dashes, or SQLite itself cannot load.
 */
export async function openDatabase(location: StoreLocation): Promise<Database> {
  const api = await (sqlite3 ??= sqlite3InitModule()); // → Sqlite3Static
  if (location.kind === "memory") return new api.oo1.DB(":memory:", "c");
  if (!NAME.test(location.name)) throw new Error(`Unusable store name: ${location.name}`);
  try {
    // One pool per database, so two databases (or two test files) never share a directory.
    const pool = await api.installOpfsSAHPoolVfs({ name: `opfs-sahpool-${location.name}` });
    return new pool.OpfsSAHPoolDb(`/${location.name}.sqlite3`);
  } catch (error) {
    const reason = `The private file system is unavailable: ${reasonOf(error)}`;
    throw new StorageUnavailableError(reason, { cause: error });
  }
}

// The database at the newest schema; one that cannot be read or brought there is closed again.
async function openMigrated(location: StoreLocation, legacy?: LegacyCanvas): Promise<Database> {
  const db = await openDatabase(location);
  try {
    db.exec("pragma foreign_keys = on");
    migrate(db, legacy);
  } catch (error) {
    db.close();
    const reason = `The saved threads could not be brought up to date: ${reasonOf(error)}`;
    throw new Error(reason, { cause: error });
  }
  return db;
}

/**
 * Opens (creating when new) the store in SQLite (ADR-081) and migrates it to the newest schema,
 * reading `legacy` only in the step from version 1. In the browser it uses the `opfs-sahpool`
 * VFS, which needs no cross-origin isolation headers but works only inside a Worker; in node
 * only `memory` works.
 *
 * @throws As `openDatabase` does; and, having closed the database again, when it cannot be
 *   read or brought up to date (a failed step, or a version newer than this build).
 */
export async function openSqliteStore(
  location: StoreLocation,
  legacy?: LegacyCanvas,
): Promise<Store> {
  const db = await openMigrated(location, legacy);

  return {
    workspace: () => readWorkspace(db),
    transcript: (id) => readTranscript(db, id),
    search: (query) => search(db, query),
    addProject: ({ id, name, createdAt }) => {
      db.exec({
        sql: "insert into projects (id, name, created_at) values (?, ?, ?)",
        bind: [id, name, createdAt],
      });
    },
    addThread: (thread, laneAt) => {
      db.transaction(() => {
        addThread(db, thread, laneAt);
      });
    },
    changeTranscript: (id, change) => {
      db.transaction(() => {
        changeTranscript(db, id, change);
      });
    },
    rename: (target, name) => {
      rename(db, target, name);
    },
    arrange: (mainId, lanes) => {
      db.transaction(() => {
        arrange(db, mainId, lanes);
      });
    },
    saveShell: (shell) => {
      db.exec({ sql: SAVE_SHELL, bind: [JSON.stringify(shell)] });
    },
    addNotification: ({ id, threadId, text, at }) => {
      db.exec({
        sql: "insert into notifications (id, thread_id, text, at) values (?, ?, ?, ?)",
        bind: [id, threadId, text, at],
      });
    },
    close: () => {
      db.close();
    },
  };
}
