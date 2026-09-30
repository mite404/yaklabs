import { describe, expect, it } from "vitest";
import type { ThreadMessage } from "./thread";
import { groupAnswers, latestEnded, requestBefore, runningActivity } from "./transcript";

const ask = (id: string, text: string): ThreadMessage => ({ id, role: "user", text, time: "9:00" });
const answer = (id: string, question: string, text: string): ThreadMessage => ({
  id,
  role: "user",
  text,
  question,
  time: "9:01",
});
const reply = (id: string, text = "Done."): Extract<ThreadMessage, { role: "agent" }> => ({
  id,
  role: "agent",
  text,
  time: "9:02",
});

describe("groupAnswers", () => {
  it("keeps every turn on its own when nothing answered a question", () => {
    const items = groupAnswers([ask("u1", "Hi"), reply("a1")]);
    expect(items.map((item) => item.kind)).toEqual(["turn", "turn"]);
  });

  it("merges consecutive answers into one item, keyed by the first", () => {
    const items = groupAnswers([
      ask("u1", "Plan the week"),
      reply("a1"),
      answer("u2", "Which region?", "North"),
      answer("u3", "How many weeks?", "Four"),
      reply("a2"),
    ]);
    expect(items.map((item) => item.kind)).toEqual(["turn", "turn", "answers", "turn"]);
    expect(items[2]).toMatchObject({
      kind: "answers",
      id: "answers-u2",
      messages: [{ id: "u2" }, { id: "u3" }],
    });
  });

  it("starts a new surface when a turn comes between two answers", () => {
    const items = groupAnswers([
      answer("u1", "Which region?", "North"),
      reply("a1"),
      answer("u2", "How many weeks?", "Four"),
    ]);
    expect(items.map((item) => item.kind)).toEqual(["answers", "turn", "answers"]);
  });

  it("never merges a plain request into an answer surface", () => {
    const items = groupAnswers([answer("u1", "Which region?", "North"), ask("u2", "Also south")]);
    expect(items.map((item) => item.kind)).toEqual(["answers", "turn"]);
  });
});

describe("requestBefore", () => {
  const messages = [
    ask("u1", "Compare the regions"),
    reply("a1"),
    answer("u2", "Which region?", "North"),
    reply("a2"),
  ];

  it("reads a reply's request back as a message", () => {
    expect(requestBefore(messages, "a1")).toEqual({
      kind: "message",
      text: "Compare the regions",
      attachments: [],
    });
  });

  it("reads an answer back as an answer", () => {
    expect(requestBefore(messages, "a2")).toEqual({ kind: "answer", text: "North" });
  });

  it("finds nothing before the first turn, or for a turn not in the thread", () => {
    expect(requestBefore([reply("a0"), ...messages], "a0")).toBeUndefined();
    expect(requestBefore(messages, "gone")).toBeUndefined();
  });
});

describe("latestEnded", () => {
  it("finds the latest reply that stopped short, of any kind", () => {
    const messages: ThreadMessage[] = [
      { ...reply("a1"), ended: "interrupted" },
      reply("a2"),
      { ...reply("a3"), ended: "cancelled" },
      reply("a4"),
    ];
    expect(latestEnded(messages)).toBe("a3");
    expect(latestEnded([reply("a1")])).toBeUndefined();
  });
});

describe("runningActivity", () => {
  it("reads the latest streaming reply's narration, or says it is working", () => {
    expect(runningActivity([reply("a1")])).toBeUndefined();
    expect(runningActivity([{ ...reply("a1"), streaming: true }])).toBe("Working");
    expect(
      runningActivity([
        { ...reply("a1"), streaming: true, activity: "Reading the cases." },
        { ...reply("a2"), streaming: true, activity: "Checking the refunds." },
      ]),
    ).toBe("Checking the refunds.");
  });
});
