/// <reference lib="webworker" />
import type { Database } from "@sqlite.org/sqlite-wasm";
import { z } from "zod";
import { conversationSchema, type Conversation } from "./protocol";
import { migrate, migrationSteps } from "./schema";
import { openDatabase, openSqliteStore } from "./sqliteStore";
import { dumpDatabase, v1Legacy, writeV1 } from "./testing";

// Started only by sqliteStore.browser.test.ts: OPFS's fast mode exists only inside a Worker.
declare const self: DedicatedWorkerGlobalScope;

// What the test asks for: save then reopen in this worker, read what an earlier one saved, or
// migrate Ethan's v1 database on a clean run and through a crash.
const requestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("save-then-reopen"),
    name: z.string(),
    conversation: conversationSchema,
  }),
  z.object({ kind: z.literal("read"), name: z.string(), id: z.string() }),
  z.object({ kind: z.literal("migrate-v1"), name: z.string() }),
]);
type Request = z.infer<typeof requestSchema>;

// The 1 → 2 step with a crash after the rebuild, before its transaction commits.
const crashingSteps: typeof migrationSteps = [
  migrationSteps[0],
  (db, legacy) => {
    migrationSteps[1](db, legacy);
    throw new Error("crashed before commit");
  },
];

async function saveThenReopen(name: string, conversation: Conversation) {
  const first = await openSqliteStore({ kind: "opfs", name });
  await first.save(conversation);
  first.close();
  const second = await openSqliteStore({ kind: "opfs", name }); // a new instance, same file
  try {
    return await second.open(conversation.id);
  } finally {
    second.close();
  }
}

async function read(name: string, id: string) {
  const store = await openSqliteStore({ kind: "opfs", name });
  try {
    return await store.open(id);
  } finally {
    store.close();
  }
}

// Opens the file, does one thing to it, and closes it, the way a worker's run would.
async function withFile<T>(name: string, work: (db: Database) => T): Promise<T> {
  const db = await openDatabase({ kind: "opfs", name });
  try {
    db.exec("pragma foreign_keys = on");
    return work(db);
  } finally {
    db.close();
  }
}

function crashOnce(db: Database): string {
  try {
    migrate(db, v1Legacy, crashingSteps);
    return "no crash";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function migrateV1(name: string) {
  const [clean, crashed] = [`${name}-clean`, `${name}-crash`];
  const v1 = await withFile(clean, (db) => (writeV1(db), dumpDatabase(db)));
  const once = await withFile(clean, (db) => (migrate(db, v1Legacy), dumpDatabase(db)));
  const twice = await withFile(clean, (db) => (migrate(db, v1Legacy), dumpDatabase(db)));
  await withFile(crashed, writeV1);
  const crash = await withFile(crashed, crashOnce);
  const afterCrash = await withFile(crashed, dumpDatabase);
  const recovered = await withFile(crashed, (db) => (migrate(db, v1Legacy), dumpDatabase(db)));
  const brokenKeys = await withFile(crashed, (db) => db.selectObjects("pragma foreign_key_check"));
  const found = await withFile(crashed, (db) =>
    db.selectValues(
      `select distinct m.conversation_id from messages_fts f join messages m on m.rowid = f.rowid
       where messages_fts match 'saturday' order by 1`,
    ),
  );
  return { v1, once, twice, crash, afterCrash, recovered, brokenKeys, found };
}

function run(request: Request): Promise<unknown> {
  switch (request.kind) {
    case "read":
      return read(request.name, request.id);
    case "save-then-reopen":
      return saveThenReopen(request.name, request.conversation);
    case "migrate-v1":
      return migrateV1(request.name);
    default: {
      const unhandled: never = request;
      return unhandled;
    }
  }
}

async function answer(data: unknown): Promise<void> {
  try {
    const result = await run(requestSchema.parse(data));
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- workers have none
    self.postMessage({ ok: true, result: result ?? null });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- workers have none
    self.postMessage({ ok: false, reason });
  }
}

self.addEventListener("message", (event) => {
  void answer(event.data);
});
