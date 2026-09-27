import { describe, expect, it } from "vitest";
import {
  landingIndex,
  laneId,
  moveItem,
  quoteFor,
  readDrop,
  shiftFor,
  slotLeft,
  sortByOrder,
  titleFor,
  type DragData,
} from "./canvas";

// A drag's data without a browser.
function transferWith(entries: Record<string, string>): DragData {
  return { types: Object.keys(entries), getData: (type) => entries[type] ?? "" };
}

describe("titleFor", () => {
  it("keeps a short highlight whole, on one line", () => {
    expect(titleFor("Saturday leads\n  at every level")).toBe("Saturday leads at every level");
  });
  it("cuts a long highlight at a word and marks the cut", () => {
    const title = titleFor("The weekend carries the week because Saturday alone brings a third");
    expect(title).toBe("The weekend carries the week because Saturday…");
    expect(title.length).toBeLessThanOrEqual(49);
  });
});

describe("quoteFor", () => {
  it("quotes every line and leaves room to ask beneath", () => {
    expect(quoteFor("one\ntwo")).toBe("> one\n> two\n\n");
  });
});

describe("readDrop", () => {
  it("takes a card over the text that rides along with it", () => {
    const card = { v: 1, kind: "catalog", payload: { title: "x" } };
    const drop = readDrop(
      transferWith({ "application/x-kay-card": JSON.stringify(card), "text/plain": "x" }),
    );
    expect(drop).toEqual({ kind: "card", card, title: "x" });
  });
  it("takes trimmed text when no card was dragged", () => {
    expect(readDrop(transferWith({ "text/plain": "  hello  " }))).toEqual({
      kind: "text",
      text: "hello",
    });
  });
  it("ignores an empty drag and a card that fails its envelope", () => {
    expect(readDrop(transferWith({ "text/plain": "   " }))).toBeUndefined();
    expect(readDrop(transferWith({ "application/x-kay-card": "{" }))).toBeUndefined();
    expect(readDrop(transferWith({ "application/x-kay-card": '{"v":2}' }))).toBeUndefined();
  });
});

describe("laneId", () => {
  it("differs between two drops in the same tick", () => {
    expect(laneId(1)).not.toBe(laneId(1));
    expect(laneId(1)).toMatch(/^thread-1-[a-z0-9]{4}$/);
  });
});

// Three lanes 200 wide with a 16 gap: centres at 100, 316 and 532.
const slots = [
  { left: 0, width: 200 },
  { left: 216, width: 200 },
  { left: 432, width: 200 },
];

describe("landingIndex", () => {
  it("stays put until the dragged centre crosses a neighbour's", () => {
    expect(landingIndex(slots, 0, 215)).toBe(0);
    expect(landingIndex(slots, 0, 217)).toBe(1);
    expect(landingIndex(slots, 0, 433)).toBe(2);
  });
  it("moves left the same way", () => {
    expect(landingIndex(slots, 2, -215)).toBe(2);
    expect(landingIndex(slots, 2, -217)).toBe(1);
    expect(landingIndex(slots, 2, -433)).toBe(0);
  });
});

describe("shiftFor and slotLeft", () => {
  it("steps the lanes between aside by the moving lane's room, and lands in the space", () => {
    expect([0, 1, 2].map((i) => shiftFor(slots, 0, 2, i, 16))).toEqual([0, -216, -216]);
    expect([0, 1, 2].map((i) => shiftFor(slots, 2, 0, i, 16))).toEqual([216, 216, 0]);
    expect([0, 1, 2].map((i) => shiftFor(slots, 1, 1, i, 16))).toEqual([0, 0, 0]);
    expect(slotLeft(slots, 0, 2)).toBe(432);
    expect(slotLeft(slots, 2, 0)).toBe(0);
  });
});

describe("moveItem and sortByOrder", () => {
  it("moves one item and keeps the rest in order", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("follows the saved order and keeps unnamed items after it", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    expect(sortByOrder(items, ["c", "a", "zzz"]).map((item) => item.id)).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
  });
});
