import { describe, expect, it } from "vitest";
import type { Conversation } from "./protocol";
import { createMemoryStore, type ConversationStore } from "./store";
import { netProfitChoice, profitThread } from "./testing";

// The seeded profit thread (with its interactive card) plus the user's next turn, which
// carries a card choice and a file.
const demo: Conversation = {
  id: "demo",
  title: profitThread.title,
  updatedAt: "2026-09-26T10:03:00.000Z",
  messages: [
    ...profitThread.messages,
    {
      id: "u2",
      role: "user",
      text: "Why is Saturday so high?",
      time: "10:03",
      attachments: [netProfitChoice],
      files: [{ id: "u2-f1", label: "till-roll.png" }],
    },
  ],
};

const trend: Conversation = {
  id: "trend",
  title: "Service desk weekly review",
  updatedAt: "2026-09-25T09:04:00.000Z",
  messages: [{ id: "u1", role: "user", text: "How did the café's service desk do?", time: "9:02" }],
};

// Each store under test, opened fresh and closed when its test ends.
const stores: [string, () => Promise<ConversationStore>][] = [
  ["memory store", () => Promise.resolve(createMemoryStore())],
];

// The ids a query finds, in the order the store returns them.
async function found(store: ConversationStore, query: string): Promise<string[]> {
  return (await store.search(query)).map((hit) => hit.id);
}

describe.each(stores)("%s saves and reads", (_, openStore) => {
  it("reads back a saved conversation, cards, chips and files included", async () => {
    const store = await openStore();
    await store.save(demo);
    expect(await store.open("demo")).toEqual(demo);
  });

  it("knows nothing about an id it never saved", async () => {
    const store = await openStore();
    expect(await store.open("missing")).toBeUndefined();
  });

  it("keeps one copy when the same conversation is saved twice", async () => {
    const store = await openStore();
    await store.save(demo);
    await store.save(demo);
    expect(await store.open("demo")).toEqual(demo);
    expect(await store.list()).toHaveLength(1);
  });

  it("replaces the earlier copy on the next save", async () => {
    const store = await openStore();
    await store.save(demo);
    const shorter = { ...demo, title: "Renamed", messages: demo.messages.slice(0, 1) };
    await store.save(shorter);
    expect(await store.open("demo")).toEqual(shorter);
  });
});

describe.each(stores)("%s lists and searches", (_, openStore) => {
  it("lists newest first, with the last message as the preview", async () => {
    const store = await openStore();
    await store.save(trend);
    await store.save(demo);
    const listed = await store.list();
    expect(listed.map((summary) => summary.id)).toEqual(["demo", "trend"]);
    expect(listed[0]).toEqual({
      id: "demo",
      title: "Last week's sales",
      updatedAt: demo.updatedAt,
      preview: "Why is Saturday so high?",
    });
  });

  it("finds a word in a message, and not a word that is in none", async () => {
    const store = await openStore();
    await store.save(demo);
    await store.save(trend);
    expect(await found(store, "Saturday")).toEqual(["demo"]);
    expect(await found(store, "forecast")).toEqual([]);
    expect(await found(store, "")).toEqual([]);
  });

  it("matches words as prefixes, ignoring case and accents", async () => {
    const store = await openStore();
    await store.save(demo);
    await store.save(trend);
    expect(await found(store, "SATUR")).toEqual(["demo"]);
    expect(await found(store, "cafe desk")).toEqual(["trend"]);
    expect(await found(store, "cafe saturday")).toEqual([]);
  });

  it("stops finding a message once a save no longer holds it", async () => {
    const store = await openStore();
    await store.save(demo);
    await store.save({ ...demo, messages: demo.messages.slice(0, 2) });
    expect(await found(store, "Saturday")).toEqual([]);
  });
});
