import type { ThreadMessage } from "@yaklabs/catalog/thread";
import { describe, expect, it, onTestFinished } from "vitest";
import { openSqliteStore } from "./sqliteStore";
import { ensureStarter, type NewThread, type Store } from "./store";
import { netProfitChoice, profitThread } from "./testing";
import {
  laneIdSchema,
  lanesOf,
  projectIdSchema,
  threadIdSchema,
  threadLane,
  type Lane,
  type Place,
} from "./workspace";

const at = (minute: number) => `2026-09-26T10:${String(minute).padStart(2, "0")}:00.000Z`;
const t = (id: string) => threadIdSchema.parse(id);
const store1 = projectIdSchema.parse("store");
const [main, child, other] = [t("main"), t("child"), t("other")];

// The profit thread plus the user's next turn, which carries a card choice and a file.
const turns: ThreadMessage[] = [
  ...profitThread.messages,
  {
    id: "u2",
    role: "user",
    text: "Why is Saturday so high?",
    time: "10:03",
    attachments: [netProfitChoice],
    files: [{ id: "u2-f1", label: "till-roll.png" }],
  },
];
const trendTurns: ThreadMessage[] = [
  { id: "u1", role: "user", text: "How did the café's service desk do?", time: "9:02" },
];
const card: Lane = {
  id: laneIdSchema.parse("c-1"),
  width: 420,
  kind: "card",
  card: { v: 1, kind: "interactive", payload: { title: "Profit" } },
  title: "Last week's profit",
};

function thread(id: string, place: Place, minute: number, messages: ThreadMessage[] = []) {
  const stamp = at(minute);
  const fresh: NewThread = {
    id: t(id),
    title: id,
    place,
    createdAt: stamp,
    updatedAt: stamp,
    draft: "",
    messages,
  };
  return fresh;
}

// A fresh, empty in-memory store, closed when the test ends.
async function openEmpty(): Promise<Store> {
  const store = await openSqliteStore({ kind: "memory" });
  onTestFinished(() => {
    store.close();
  });
  return store;
}

// A fresh store holding one project with two mains, "main" (the profit turns) and "other"
// (the service desk's).
async function openStore(): Promise<Store> {
  const store = await openEmpty();
  store.addProject({ id: store1, name: "Demo store", createdAt: at(0) });
  store.addThread(thread("main", { kind: "main", projectId: store1 }, 1, turns));
  store.addThread(thread("other", { kind: "main", projectId: store1 }, 2, trendTurns));
  return store;
}

const addChild = (store: Store, id: string, laneAt?: number) => {
  store.addThread(thread(id, { kind: "child", parentId: main }, 3), laneAt);
};
const found = (store: Store, query: string) => store.search(query).map((each) => each.id);

describe("the store keeps threads", () => {
  it("starts empty", async () => {
    const store = await openEmpty();
    expect(store.workspace()).toEqual({
      projects: [],
      threads: [],
      lanes: {},
      shell: null,
      notifications: [],
    });
  });

  it("reads back a thread's turns, cards, chips and files, and lists it with its preview", async () => {
    const store = await openStore();
    expect(store.transcript(main)).toEqual({ messages: turns, draft: "", updatedAt: at(1) });
    expect(store.workspace().threads.at(0)).toMatchObject({
      id: "main",
      place: { kind: "main", projectId: "store" },
      preview: "Why is Saturday so high?",
    });
    expect(store.transcript(t("missing"))).toBeUndefined();
  });

  it("rewrites a transcript from what it is now, and refuses an unknown thread", async () => {
    const store = await openStore();
    store.changeTranscript(main, (now) => ({
      ...now,
      messages: now.messages.slice(0, 1),
      draft: "Hi",
      updatedAt: at(9),
    }));
    expect(store.transcript(main)).toEqual({
      messages: turns.slice(0, 1),
      draft: "Hi",
      updatedAt: at(9),
    });
    expect(() => {
      store.changeTranscript(t("missing"), (now) => now);
    }).toThrow("No thread missing");
  });
});

describe("the store renames", () => {
  it("renames a project and a thread, and refuses one it does not hold", async () => {
    const store = await openStore();
    store.rename({ kind: "project", id: store1 }, "Corner shop");
    store.rename({ kind: "thread", id: main }, "Weekend margins");
    const { projects, threads } = store.workspace();
    expect(projects.map((project) => project.name)).toEqual(["Corner shop"]);
    expect(threads.map((each) => each.title)).toEqual(["Weekend margins", "other"]);
    expect(() => {
      store.rename({ kind: "thread", id: t("missing") }, "x");
    }).toThrow("No thread missing");
  });
});

describe("the store keeps lanes", () => {
  it("puts a new child's lane where it was dropped, in the same write", async () => {
    const store = await openStore();
    addChild(store, "child", 0);
    addChild(store, "second", 0);
    addChild(store, "closed");
    expect(lanesOf(store.workspace(), main).map((lane) => lane.id)).toEqual([
      "l-second",
      "l-child",
    ]);
  });

  it("sets a canvas to exactly the lanes it is given, the same on a second run", async () => {
    const store = await openStore();
    addChild(store, "child");
    store.arrange(main, [card, threadLane(child)]);
    const once = store.workspace();
    store.arrange(main, [card, threadLane(child)]);
    expect(store.workspace()).toEqual(once);
    expect(once.lanes).toEqual({ [main]: [card, threadLane(child)], [other]: [] });
  });

  it("refuses a canvas for a sub-thread, an unknown thread, or another main's child", async () => {
    const store = await openStore();
    addChild(store, "child");
    expect(() => {
      store.arrange(child, []);
    }).toThrow("child is a sub-thread, so it has no canvas");
    expect(() => {
      store.arrange(t("missing"), []);
    }).toThrow("No thread missing");
    expect(() => {
      store.arrange(other, [threadLane(child)]);
    }).toThrow("a thread lane on its own");
    expect(store.workspace().lanes[other]).toEqual([]);
  });

  it("gives a main thread no lane of its own", async () => {
    const store = await openStore();
    expect(() => {
      store.addThread(thread("third", { kind: "main", projectId: store1 }, 4), 0);
    }).toThrow("third is a main thread, so it has no lane");
    expect(store.workspace().threads.map((each) => each.id)).toEqual(["main", "other"]);
  });
});

describe("the store keeps the shell and the bell", () => {
  it("keeps the latest shell whole", async () => {
    const store = await openStore();
    store.saveShell({ version: 1, tabs: ["main"] });
    store.saveShell({ version: 1, tabs: ["other", "main"], read: [] });
    expect(store.workspace().shell).toEqual({ version: 1, tabs: ["other", "main"], read: [] });
  });

  it("lists notifications newest first", async () => {
    const store = await openStore();
    store.addNotification({ id: "n1", threadId: main, text: "Older", at: at(5) });
    store.addNotification({ id: "n2", threadId: other, text: "Newer", at: at(6) });
    expect(store.workspace().notifications.map((each) => each.id)).toEqual(["n2", "n1"]);
  });
});

describe("the store searches", () => {
  it("finds a word in a message, and not a word that is in none", async () => {
    const store = await openStore();
    expect(found(store, "Saturday")).toEqual(["main"]);
    expect(found(store, "forecast")).toEqual([]);
    expect(found(store, "")).toEqual([]);
  });

  it("matches words as prefixes, ignoring case and accents", async () => {
    const store = await openStore();
    expect(found(store, "SATUR")).toEqual(["main"]);
    expect(found(store, "cafe desk")).toEqual(["other"]);
    expect(found(store, "cafe saturday")).toEqual([]);
  });

  it("lists hits newest first, and stops finding a message once it is gone", async () => {
    const store = await openStore();
    store.changeTranscript(other, (now) => ({ ...now, messages: turns, updatedAt: at(8) }));
    expect(found(store, "saturday")).toEqual(["other", "main"]);
    store.changeTranscript(main, (now) => ({ ...now, messages: now.messages.slice(0, 2) }));
    expect(found(store, "saturday")).toEqual(["other"]);
  });
});

describe("ensureStarter", () => {
  it("gives an empty device the Demo store and its profit thread, once", async () => {
    const store = await openEmpty();
    ensureStarter(store, at(0));
    const once = store.workspace();
    ensureStarter(store, at(5));
    expect(store.workspace()).toEqual(once);
    expect(once.projects).toEqual([{ id: "demo-store", name: "Demo store", createdAt: at(0) }]);
    expect(once.threads.map((each) => [each.id, each.title])).toEqual([
      ["profit", profitThread.title],
    ]);
    expect(store.transcript(t("profit"))?.messages).toEqual(profitThread.messages);
  });

  it("leaves a store that holds any thread alone", async () => {
    const store = await openStore();
    const before = store.workspace();
    ensureStarter(store, at(5));
    expect(store.workspace()).toEqual(before);
  });
});
