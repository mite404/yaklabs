import { describe, expect, it } from "vitest";
import { bookmarkLabel, matchStatus, matchesOf, requestsOf, stepMatch } from "./threadReading";
import type { ThreadMessage } from "./thread";

const messages: ThreadMessage[] = [
  { id: "u1", role: "user", text: "How did profit do last week?", time: "9:02" },
  { id: "a1", role: "agent", text: "Profit rose 12% on the week.", time: "9:02" },
  { id: "u2", role: "user", text: "Show revenue", time: "9:05" },
  { id: "a2", role: "agent", text: "Here is revenue by day.", time: "9:05" },
];

describe("bookmarkLabel", () => {
  it("keeps a short request whole", () => {
    expect(bookmarkLabel("Show revenue")).toBe("Show revenue");
  });

  it("cuts a long request at 15 characters and marks the cut", () => {
    expect(bookmarkLabel("How did profit do last week?")).toBe("How did profit…");
  });

  it("never splits an emoji, and folds line breaks into spaces", () => {
    expect(bookmarkLabel("📈📈📈📈📈📈📈📈📈📈📈📈📈📈📈📈")).toBe(`${"📈".repeat(15)}…`);
    expect(bookmarkLabel("  two\n\nlines ")).toBe("two lines");
  });
});

describe("requestsOf", () => {
  it("lists only the user's turns, oldest first", () => {
    expect(requestsOf(messages).map((request) => request.id)).toEqual(["u1", "u2"]);
    expect(requestsOf(messages)[0]).toMatchObject({ label: "How did profit…", time: "9:02" });
  });
});

describe("matchesOf", () => {
  it("finds turns of either role, ignoring case", () => {
    expect(matchesOf(messages, "PROFIT")).toEqual(["u1", "a1"]);
    expect(matchesOf(messages, "revenue")).toEqual(["u2", "a2"]);
  });

  it("matches nothing for a blank query", () => {
    expect(matchesOf(messages, "   ")).toEqual([]);
  });
});

describe("stepMatch", () => {
  const ids = ["u1", "a1", "u2"];

  it("starts at the first going forward and the last going back", () => {
    expect(stepMatch(ids, undefined, 1)).toBe("u1");
    expect(stepMatch(ids, undefined, -1)).toBe("u2");
  });

  it("wraps at either end", () => {
    expect(stepMatch(ids, "u2", 1)).toBe("u1");
    expect(stepMatch(ids, "u1", -1)).toBe("u2");
  });

  it("starts over when the current match no longer matches", () => {
    expect(stepMatch(ids, "gone", 1)).toBe("u1");
    expect(stepMatch([], "u1", 1)).toBeUndefined();
  });
});

describe("matchStatus", () => {
  it("counts matches until one is showing, then says which", () => {
    expect(matchStatus([])).toBe("No matches");
    expect(matchStatus(["u1"])).toBe("1 match");
    expect(matchStatus(["u1", "a1"])).toBe("2 matches");
    expect(matchStatus(["u1", "a1"], "a1")).toBe("2 of 2");
  });
});
