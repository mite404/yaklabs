import { describe, expect, it } from "vitest";
import { laneId, quoteFor, readDrop, titleFor, type DragData } from "./canvas";

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
    expect(drop).toEqual({ kind: "card", card });
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
