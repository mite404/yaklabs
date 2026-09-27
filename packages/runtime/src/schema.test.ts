import type { Database } from "@sqlite.org/sqlite-wasm";
import { describe, expect, it, onTestFinished } from "vitest";
import type { LegacyCanvas } from "./protocol";
import { migrate, planV2, type V1Row } from "./schema";
import { openDatabase } from "./sqliteStore";
import { threadIdSchema, threadLane } from "./workspace";

const row = (id: string, minute: number): V1Row => ({
  id: threadIdSchema.parse(id),
  updatedAt: `2026-09-26T10:${String(minute).padStart(2, "0")}:00.000Z`,
});

// Ethan's v1 rows: profit, then three lanes dropped on its canvas, oldest first.
const profit = row("profit", 3);
const [a, b, c] = [row("thread-a", 5), row("thread-b", 9), row("thread-c", 12)];
const demoStore = { id: "demo-store", name: "Demo store", createdAt: profit.updatedAt };
const lanesOnProfit = (rows: V1Row[]) => [
  { mainId: "profit", lanes: rows.map((each) => threadLane(each.id)) },
];
const asMain = (each: V1Row) => ({
  id: each.id,
  createdAt: each.updatedAt,
  place: { kind: "main", projectId: "demo-store" },
});
const asChild = (each: V1Row) => ({
  id: each.id,
  createdAt: each.updatedAt,
  place: { kind: "child", parentId: "profit" },
});

// A fresh in-memory database at the newest schema, with a project and one main, "main".
async function freshDatabase(): Promise<Database> {
  const db = await openDatabase({ kind: "memory" });
  onTestFinished(() => {
    db.close();
  });
  db.exec("pragma foreign_keys = on");
  migrate(db);
  db.exec("insert into projects values ('p', 'P', '2026-09-26T10:00:00.000Z')");
  insertThread(db, "main", "p", null);
  return db;
}

function insertThread(db: Database, id: string, project: string | null, parent: string | null) {
  db.exec({
    sql: `insert into conversations (id, title, created_at, updated_at, project_id, parent_id)
          values (?, ?, '2026-09-26T10:00:00.000Z', '2026-09-26T10:00:00.000Z', ?, ?)`,
    bind: [id, id, project, parent],
  });
}

// Puts a lane on `main`: a thread lane when `thread` is given, else a card lane.
function insertLane(db: Database, main: string, seq: number, id: string, thread?: string) {
  const card = thread === undefined ? ['{"v":1}', "Card"] : [null, null];
  db.exec({
    sql: `insert into lanes (main_id, seq, id, thread_id, card_json, title)
          values (?, ?, ?, ?, ?, ?)`,
    bind: [main, seq, id, thread ?? null, ...card],
  });
}

describe("planV2", () => {
  it.each<[string, V1Row[], LegacyCanvas | undefined, unknown]>([
    [
      "plans nothing for an empty database",
      [],
      undefined,
      { projects: [], threads: [], lanes: [] },
    ],
    [
      "makes profit the main and keeps the lanes the v1 canvas showed, in its order",
      [c, a, profit, b],
      { hidden: ["thread-b"], order: ["thread-c"] },
      {
        projects: [demoStore],
        threads: [asMain(profit), asChild(a), asChild(b), asChild(c)],
        lanes: lanesOnProfit([c, a]),
      },
    ],
    [
      "opens every child oldest first when the page had no canvas keys",
      [profit, c, a],
      undefined,
      {
        projects: [demoStore],
        threads: [asMain(profit), asChild(a), asChild(c)],
        lanes: lanesOnProfit([a, c]),
      },
    ],
    [
      "ignores keys that name no conversation",
      [profit, a],
      { hidden: ["gone"], order: ["gone", "thread-a"] },
      { projects: [demoStore], threads: [asMain(profit), asChild(a)], lanes: lanesOnProfit([a]) },
    ],
    [
      "makes every conversation a main, with no lanes, when there is no profit",
      [b, a],
      { hidden: [], order: ["thread-b"] },
      {
        projects: [{ ...demoStore, createdAt: a.updatedAt }],
        threads: [asMain(a), asMain(b)],
        lanes: [],
      },
    ],
  ])("%s", (_, rows, legacy, expected) => {
    expect(planV2(rows, legacy)).toEqual(expected);
  });
});

describe("migrate", () => {
  it("brings a new database to version 2, and leaves it there on a second run", async () => {
    const db = await freshDatabase();
    migrate(db);
    expect(db.selectValue("pragma user_version")).toBe(2);
  });

  it("refuses a database newer than this build", async () => {
    const db = await freshDatabase();
    db.exec("pragma user_version = 3");
    expect(() => {
      migrate(db);
    }).toThrow("The database is at version 3, newer than this build");
  });
});

describe("the v2 schema keeps every thread in one place", () => {
  it.each<[string, string | null, string | null]>([
    ["both a main and a child", "p", "main"],
    ["neither a main nor a child", null, null],
  ])("refuses a thread that is %s", async (_, project, parent) => {
    const db = await freshDatabase();
    expect(() => {
      insertThread(db, "odd", project, parent);
    }).toThrow(/CHECK constraint failed/);
  });

  it("refuses a sub-thread of a sub-thread, and a thread that moves", async () => {
    const db = await freshDatabase();
    insertThread(db, "child", null, "main");
    expect(() => {
      insertThread(db, "grandchild", null, "child");
    }).toThrow("A sub-thread cannot have sub-threads");
    expect(() => {
      db.exec("update conversations set parent_id = null, project_id = 'p' where id = 'child'");
    }).toThrow("A thread never changes place");
  });

  it("refuses a thread that is its own parent", async () => {
    const db = await freshDatabase();
    expect(() => {
      insertThread(db, "selfie", null, "selfie");
    }).toThrow("A sub-thread's parent is a main thread");
  });
});

describe("the v2 schema keeps lanes on their own main", () => {
  it("takes a sub-thread's lane on its main, once, and nowhere else", async () => {
    const db = await freshDatabase();
    insertThread(db, "other", "p", null);
    insertThread(db, "kid", null, "main");
    insertLane(db, "main", 0, "l-kid", "kid");
    expect(() => {
      insertLane(db, "other", 0, "l-kid", "kid");
    }).toThrow("A lane sits on a main thread, and a thread lane on its own");
    expect(() => {
      insertLane(db, "main", 1, "l-kid", "kid");
    }).toThrow(/UNIQUE constraint failed/);
    expect(() => {
      insertLane(db, "main", 1, "l-main", "kid");
    }).toThrow(/CHECK constraint failed/);
  });

  it("puts no lane on a sub-thread's canvas, and edits no lane in place", async () => {
    const db = await freshDatabase();
    insertThread(db, "kid", null, "main");
    insertLane(db, "main", 0, "c-1");
    expect(() => {
      insertLane(db, "kid", 0, "c-2");
    }).toThrow("A lane sits on a main thread, and a thread lane on its own");
    expect(() => {
      db.exec("update lanes set seq = 5");
    }).toThrow("Lanes are replaced, never edited");
  });
});
