import { describe, expect, it } from "vitest";
import {
  CUT_OFF,
  canRetry,
  canSend,
  reducePlayground,
  statusLine,
  type AgentTurn,
  type Cause,
} from "./state";
import { QUESTION, barCard, event, run, say, send, streamed } from "./test-fixtures";

const start = { type: "start", seq: 0, v: 1 } as const;
const work = (seq: number, label: string, status: "running" | "done" = "running") =>
  ({ type: "work", seq, workId: "count", label, status }) as const;
const text = (seq: number, blockId: string, delta: string) =>
  ({ type: "text", seq, blockId, delta }) as const;
const end = (seq: number) => ({ type: "end", seq, reason: "answered" }) as const;
const asked = (seq: number) =>
  ({ type: "question", seq, questionId: "q1", question: QUESTION }) as const;
const lastAgent = (state: ReturnType<typeof run>) => state.exchanges.at(-1)?.agent;
const firstAgent = (state: ReturnType<typeof run>): AgentTurn => {
  const agent = state.exchanges.at(0)?.agent;
  if (agent === undefined) throw new Error("No exchange was sent.");
  return agent;
};
const bodyOf = (state: ReturnType<typeof run>) => {
  const agent = lastAgent(state);
  return agent !== undefined && "body" in agent ? agent.body : null;
};

const broken = (cause: Cause) =>
  run([send("x1", say("hi")), { kind: "broke", exchangeId: "x1", cause }]);

describe("reducePlayground: events", () => {
  it("sends a message as a waiting exchange", () => {
    expect(lastAgent(run([send("x1", say("hi"))]))).toEqual({ phase: "waiting" });
  });

  it("ignores a repeated or older seq, returning the same state", () => {
    const state = streamed([start, text(1, "b0", "Hi")]);
    expect(reducePlayground(state, event("x1", text(1, "b0", "Hi")))).toBe(state);
    expect(reducePlayground(state, event("x1", text(0, "b0", "Hi")))).toBe(state);
  });

  it("ignores events for an earlier exchange and after the reply settled", () => {
    const state = run([send("x2", say("again"))], streamed([start, end(1)]));
    expect(reducePlayground(state, event("x1", text(5, "b0", "late")))).toBe(state);
    const done = streamed([start, end(1)]);
    expect(reducePlayground(done, event("x1", text(2, "b0", "late")))).toBe(done);
    const waiting = streamed([start, asked(1)]);
    expect(reducePlayground(waiting, event("x1", text(2, "b0", "late")))).toBe(waiting);
  });
});

describe("reducePlayground: cards and work", () => {
  it("replaces a card with the same cardId in place and bumps its revision", () => {
    const state = streamed([
      start,
      { type: "card", seq: 1, cardId: "cases", selection: barCard("First") },
      text(2, "b0", "Between"),
      { type: "card", seq: 3, cardId: "cases", selection: barCard("Second"), note: "Updated" },
    ]);
    expect(bodyOf(state)?.items.map((item) => item.kind)).toEqual(["card", "text"]);
    expect(bodyOf(state)?.cards.cases).toMatchObject({ revision: 1, note: "Updated" });
    expect(bodyOf(state)?.cards.cases?.selection.props.title).toBe("Second");
  });

  it("moves a narrated text block into its work, replacing the last narration", () => {
    const state = streamed([
      start,
      work(1, "Counting"),
      text(2, "b0", "First look."),
      { type: "narration", seq: 3, blockId: "b0", workId: "count" },
      text(4, "b1", " Second look. "),
      { type: "narration", seq: 5, blockId: "b1", workId: "count" },
    ]);
    expect(bodyOf(state)?.items).toEqual([]);
    expect(bodyOf(state)?.text).toEqual({});
    expect(bodyOf(state)?.works.count).toMatchObject({
      narration: "Second look.",
      log: ["First look.", "Second look."],
    });
  });

  it("logs the old label when a work item is relabelled", () => {
    const state = streamed([start, work(1, "Counting"), work(2, "Totalling", "done")]);
    expect(bodyOf(state)?.works.count).toMatchObject({
      label: "Totalling",
      status: "done",
      log: ["Counting"],
    });
  });
});

describe("reducePlayground: settling", () => {
  it("settles only the outcome's own work and shows the outcome in place", () => {
    const state = streamed([
      start,
      work(1, "Counting"),
      { type: "work", seq: 2, workId: "sort", label: "Sorting", status: "running" },
      { type: "outcome", seq: 3, workId: "count", result: "12 cases", evidence: ["Mon 4"] },
    ]);
    expect(bodyOf(state)?.works.count?.status).toBe("done");
    expect(bodyOf(state)?.works.count?.outcome).toEqual({
      result: "12 cases",
      evidence: ["Mon 4"],
    });
    expect(bodyOf(state)?.works.sort?.status).toBe("running");
    expect(bodyOf(state)?.items).toEqual([{ kind: "outcome", workId: "count" }]);
  });

  it("keeps every failure as its own item and fails the work it names", () => {
    const failure = {
      type: "failure",
      workId: "count",
      limitation: "I cannot fetch live data.",
      recovery: null,
    } as const;
    const state = streamed([
      start,
      work(1, "Counting"),
      { ...failure, seq: 2 },
      { ...failure, seq: 3 },
    ]);
    expect(bodyOf(state)?.items).toEqual([
      { kind: "failure", index: 0 },
      { kind: "failure", index: 1 },
    ]);
    expect(bodyOf(state)?.works.count?.status).toBe("failed");
  });
});

describe("reducePlayground: ending", () => {
  it("ends a reply with every running work unfinished", () => {
    const state = streamed([start, work(1, "Counting"), end(2)]);
    expect(lastAgent(state)?.phase).toBe("done");
    expect(bodyOf(state)?.works.count?.status).toBe("unfinished");
  });

  it("treats end asked without a question as done", () => {
    const state = streamed([start, { type: "end", seq: 1, reason: "asked" }]);
    expect(lastAgent(state)?.phase).toBe("done");
  });

  it("fails a reply the stream closed early, and ignores a close after the end", () => {
    expect(lastAgent(run([send("x1", say("hi")), { kind: "closed", exchangeId: "x1" }]))).toEqual({
      phase: "failed",
      body: null,
      cause: CUT_OFF,
    });
    const cut = reducePlayground(streamed([start, work(1, "Counting")]), {
      kind: "closed",
      exchangeId: "x1",
    });
    expect(lastAgent(cut)).toMatchObject({ phase: "failed", cause: CUT_OFF });
    expect(bodyOf(cut)?.works.count?.status).toBe("unfinished");
    const done = streamed([start, end(1)]);
    expect(reducePlayground(done, { kind: "closed", exchangeId: "x1" })).toBe(done);
  });
});

describe("reducePlayground: retry and questions", () => {
  it("retries a failed reply only when its cause allows it", () => {
    const retry = { kind: "retry", exchangeId: "x1" } as const;
    expect(lastAgent(reducePlayground(broken(CUT_OFF), retry))).toEqual({ phase: "waiting" });
    const final = broken({ ...CUT_OFF, retry: false });
    expect(reducePlayground(final, retry)).toBe(final);
  });
});

describe("reducePlayground: retrying what the gateway ended", () => {
  it("retries a reply the gateway ended at a limit or an upstream failure", () => {
    const retry = { kind: "retry", exchangeId: "x1" } as const;
    for (const reason of ["upstream", "limit"] as const) {
      const ended = streamed([start, text(1, "b0", "Fri"), { type: "end", seq: 2, reason }]);
      expect(lastAgent(ended)).toMatchObject({ phase: "done", reason });
      expect(canRetry(firstAgent(ended))).toBe(true);
      expect(lastAgent(reducePlayground(ended, retry))).toEqual({ phase: "waiting" });
    }
  });

  it("does not retry a reply that answered", () => {
    const answered = streamed([start, text(1, "b0", "Friday."), end(2)]);
    expect(canRetry(firstAgent(answered))).toBe(false);
    expect(reducePlayground(answered, { kind: "retry", exchangeId: "x1" })).toBe(answered);
  });
});

describe("reducePlayground: questions", () => {
  it("holds the page while a question waits and takes only its own answer", () => {
    const state = streamed([start, asked(1)]);
    expect(lastAgent(state)?.phase).toBe("asked");
    expect(canSend(state, say("something else"))).toBe(false);
    const wrong = send("x2", { kind: "answer", questionId: "q9", text: "This week" });
    expect(reducePlayground(state, wrong)).toBe(state);
    const answered = reducePlayground(
      state,
      send("x2", { kind: "answer", questionId: "q1", text: "This week" }),
    );
    expect(answered.exchanges.at(0)?.agent).toMatchObject({
      phase: "resolved",
      reply: { kind: "answer", text: "This week", at: "9:00 AM" },
    });
    expect(lastAgent(answered)).toEqual({ phase: "waiting" });
  });

  it("records a skip as the question's reply", () => {
    const skipped = run(
      [send("x2", { kind: "skip", questionId: "q1" })],
      streamed([start, asked(1)]),
    );
    expect(skipped.exchanges.at(0)?.agent).toMatchObject({
      phase: "resolved",
      reply: { kind: "skip" },
    });
  });

  it("refuses an answer when no question waits, and a message while one streams", () => {
    const state = streamed([start]);
    expect(canSend(state, { kind: "skip", questionId: "q1" })).toBe(false);
    expect(reducePlayground(state, send("x2", say("more")))).toBe(state);
  });
});

describe("statusLine", () => {
  it("names the current work, then its narration, until answer text follows it", () => {
    const working = streamed([start, work(1, "Counting")]);
    expect(statusLine(firstAgent(working))).toBe("Counting");
    const narrated = streamed([
      start,
      work(1, "Counting"),
      text(2, "b0", "Adding Monday."),
      { type: "narration", seq: 3, blockId: "b0", workId: "count" },
    ]);
    expect(statusLine(firstAgent(narrated))).toBe("Adding Monday.");
    const answered = streamed([start, work(1, "Counting"), text(2, "b1", "It is 12.")]);
    expect(statusLine(firstAgent(answered))).toBeUndefined();
    const blank = streamed([start, work(1, "Counting"), text(2, "b1", " ")]);
    expect(statusLine(firstAgent(blank))).toBe("Counting");
  });

  it("keeps Thinking on while the model reasons with no work running", () => {
    expect(statusLine(firstAgent(streamed([start])))).toBe("Thinking…");
    const card = {
      type: "card",
      seq: 3,
      cardId: "cases",
      selection: barCard("Cases"),
    } as const;
    const between = streamed([start, work(1, "Counting"), work(2, "Counting", "done"), card]);
    expect(statusLine(firstAgent(between))).toBe("Thinking…");
    const answering = streamed([start, card, text(4, "b1", "Tuesday was busiest.")]);
    expect(statusLine(firstAgent(answering))).toBeUndefined();
  });

  it("shows nothing once the reply is no longer streaming", () => {
    const done = streamed([start, work(1, "Counting"), end(2)]);
    expect(statusLine(firstAgent(done))).toBeUndefined();
  });
});
