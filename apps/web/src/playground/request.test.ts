import { playgroundRequestSchema } from "@yaklabs/catalog/playground";
import { describe, expect, it } from "vitest";
import { toPlaygroundRequest } from "./request";
import { CUT_OFF, initialPlayground } from "./state";
import { QUESTION, barCard, event, run, say, send, streamed } from "./test-fixtures";

const start = { type: "start", seq: 0, v: 2 } as const;

// A finished reply with work, answer text, a card, an outcome and a failure.
const full = streamed([
  start,
  { type: "work", seq: 1, workId: "count", label: "Counting", status: "running" },
  { type: "text", seq: 2, blockId: "b0", delta: "Counting Monday." },
  { type: "card", seq: 4, cardId: "cases", selection: barCard("Cases") },
  { type: "outcome", seq: 5, workId: "count", result: "11 cases", evidence: ["Mon 4"] },
  { type: "failure", seq: 6, workId: null, limitation: "No live data.", recovery: null },
  { type: "text", seq: 7, blockId: "b1", delta: "There were **11** cases." },
  { type: "end", seq: 8, reason: "answered" },
]);

describe("toPlaygroundRequest", () => {
  it("sends only the next message when nothing came before", () => {
    expect(toPlaygroundRequest(initialPlayground, say("hi"))).toEqual({
      exchanges: [{ user: { kind: "say", text: "hi" } }],
    });
  });

  it("sends a finished reply's text, cards, outcomes and failures", () => {
    const request = toPlaygroundRequest(full, say("next"));
    expect(request.exchanges.at(0)?.agent).toEqual({
      text: "Counting Monday.\n\nThere were **11** cases.",
      cards: [{ cardId: "cases", selection: barCard("Cases") }],
      outcomes: [{ workId: "count", result: "11 cases" }],
      failures: [{ limitation: "No live data." }],
    });
    expect(playgroundRequestSchema.safeParse(request).success).toBe(true);
  });
});

describe("toPlaygroundRequest: questions", () => {
  it("sends an answered question with the answer as the next exchange", () => {
    const state = streamed([
      start,
      { type: "question", seq: 1, questionId: "q1", question: QUESTION },
    ]);
    const answer = { kind: "answer", questionId: "q1", text: "This week" } as const;
    const request = toPlaygroundRequest(state, answer);
    expect(request.exchanges).toEqual([
      {
        user: { kind: "say", text: "hi" },
        agent: {
          text: "",
          cards: [],
          outcomes: [],
          failures: [],
          question: { questionId: "q1", question: QUESTION },
        },
      },
      { user: answer },
    ]);
    expect(playgroundRequestSchema.safeParse(request).success).toBe(true);
  });

  it("sends a skipped question the same way, with the skip after it", () => {
    const asked = streamed([
      start,
      { type: "question", seq: 1, questionId: "q1", question: QUESTION },
    ]);
    const skipped = run(
      [send("x2", { kind: "skip", questionId: "q1" }), event("x2", start)],
      asked,
    );
    const request = toPlaygroundRequest(
      run([event("x2", { type: "end", seq: 1, reason: "answered" })], skipped),
      say("thanks"),
    );
    expect(request.exchanges.map((exchange) => exchange.user.kind)).toEqual(["say", "skip", "say"]);
    expect(request.exchanges.at(0)?.agent?.question?.questionId).toBe("q1");
    expect(playgroundRequestSchema.safeParse(request).success).toBe(true);
  });
});

describe("toPlaygroundRequest: failures and limits", () => {
  it("sends a failed reply with what it showed and its cause as a failure", () => {
    const cut = run(
      [{ kind: "closed", exchangeId: "x1" }],
      streamed([
        start,
        { type: "card", seq: 1, cardId: "cases", selection: barCard("Cases") },
        { type: "text", seq: 2, blockId: "b0", delta: "Partial" },
      ]),
    );
    expect(toPlaygroundRequest(cut, say("again")).exchanges.at(0)?.agent).toEqual({
      text: "Partial",
      cards: [{ cardId: "cases", selection: barCard("Cases") }],
      outcomes: [],
      failures: [{ limitation: CUT_OFF.title }],
    });
    const empty = run([send("x1", say("hi")), { kind: "closed", exchangeId: "x1" }]);
    expect(toPlaygroundRequest(empty, say("again")).exchanges.at(0)?.agent?.failures).toEqual([
      { limitation: CUT_OFF.title },
    ]);
  });

  it("leaves out a reply still streaming", () => {
    const streaming = streamed([start]);
    expect(toPlaygroundRequest(streaming, say("next")).exchanges).toEqual([
      { user: { kind: "say", text: "next" } },
    ]);
  });

  it("keeps the latest 49 exchanges, starting on a message", () => {
    const many = Array.from({ length: 60 }, (_, i) => [
      send(`x${String(i)}`, say(`m${String(i)}`)),
      event(`x${String(i)}`, { type: "end", seq: 0, reason: "answered" }),
    ]).flat();
    const request = toPlaygroundRequest(run(many), say("last"));
    expect(request.exchanges).toHaveLength(50);
    expect(request.exchanges.at(0)?.user).toEqual({ kind: "say", text: "m11" });
    expect(playgroundRequestSchema.safeParse(request).success).toBe(true);
  });
});
