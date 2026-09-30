import { describe, expect, it } from "vitest";
import { plainText } from "./prose";
import {
  applyChunk,
  cancelReply,
  completeReply,
  startReply,
  workSummary,
  type AgentMessage,
  type ReplyChunk,
} from "./reply";

const fold = (chunks: ReplyChunk[]): AgentMessage =>
  chunks.reduce(applyChunk, startReply("a1", "9:02"));

describe("applyChunk", () => {
  it("keeps a plain word stream plain: text grows, no blocks appear", () => {
    const turn = fold(["Closed", " cases", " rose."]);
    expect(turn.text).toBe("Closed cases rose.");
    expect(turn.blocks).toBeUndefined();
  });

  it("turns structured the moment a mark arrives, carrying the words so far", () => {
    const turn = fold([
      "The backlog fell from ",
      { kind: "text", text: "46 to 18", mark: "strong" },
    ]);
    expect(turn.blocks).toEqual([
      {
        kind: "paragraph",
        content: [
          { kind: "run", text: "The backlog fell from " },
          { kind: "run", text: "46 to 18", mark: "strong" },
        ],
      },
    ]);
    expect(turn.text).toBe("The backlog fell from 46 to 18");
  });

  it("joins words streamed one at a time into one run per mark", () => {
    const turn = fold([
      { kind: "text", text: "12", mark: "strong" },
      { kind: "text", text: " are", mark: "strong" },
      { kind: "text", text: " billing", mark: "strong" },
      { kind: "text", text: "." },
    ]);
    expect(turn.blocks?.[0]).toEqual({
      kind: "paragraph",
      content: [
        { kind: "run", text: "12 are billing", mark: "strong" },
        { kind: "run", text: "." },
      ],
    });
  });

  it("opens paragraphs, headings and list items where the stream says", () => {
    const turn = fold([
      { kind: "block", block: "heading" },
      { kind: "text", text: "What I'd flag" },
      { kind: "block", block: "list" },
      { kind: "text", text: "Access requests" },
      { kind: "block", block: "item" },
      { kind: "text", text: "Product questions" },
      { kind: "block", block: "paragraph" },
      { kind: "text", text: "Nothing needs escalation." },
    ]);
    expect(turn.blocks?.map((block) => block.kind)).toEqual(["heading", "list", "paragraph"]);
    expect(turn.blocks?.[1]).toEqual({
      kind: "list",
      items: [
        [{ kind: "run", text: "Access requests" }],
        [{ kind: "run", text: "Product questions" }],
      ],
    });
    expect(plainText(turn.blocks ?? [])).toBe(
      "What I'd flag\nAccess requests\nProduct questions\nNothing needs escalation.",
    );
  });

  it("places a card between paragraphs and starts a new paragraph after it", () => {
    const turn = fold([
      "Before.",
      { kind: "card", payload: { component: "LineChart" } },
      { kind: "text", text: "After." },
    ]);
    expect(turn.blocks?.map((block) => block.kind)).toEqual(["paragraph", "card", "paragraph"]);
    expect(turn.text).toBe("Before.After.");
  });

  it("supersedes narration and keeps what it replaced", () => {
    const turn = fold([
      { kind: "activity", text: "Thinking." },
      { kind: "activity", text: "Selecting the support records." },
      { kind: "activity", text: "Checking the workload." },
    ]);
    expect(turn.activity).toBe("Checking the workload.");
    expect(turn.work?.narration).toEqual(["Thinking.", "Selecting the support records."]);
  });

  it("upserts steps by id in the order they first appeared", () => {
    const turn = fold([
      { kind: "step", step: { id: "a", label: "Workload", status: "running" } },
      { kind: "step", step: { id: "b", label: "Issues", status: "running" } },
      {
        kind: "step",
        step: { id: "a", label: "Workload", status: "done", outcome: "Fell to 18." },
      },
      { kind: "log", text: "check:a done" },
    ]);
    expect(turn.work?.steps.map((step) => [step.id, step.status])).toEqual([
      ["a", "done"],
      ["b", "running"],
    ]);
    expect(turn.work?.logs).toEqual(["check:a done"]);
  });

  it("ends a reply that fails before any words as failed, and after some as interrupted", () => {
    const failure = { title: "Reply interrupted", detail: "The order system stopped answering." };
    const before = fold([
      { kind: "activity", text: "Thinking." },
      { kind: "failure", failure },
    ]);
    expect(before.ended).toBe("failed");
    expect(before.streaming).toBe(false);
    expect(before.activity).toBeUndefined();
    const after = fold(["39 of 41 match", { kind: "failure", failure }]);
    expect(after.ended).toBe("interrupted");
    expect(after.failure).toEqual(failure);
  });

  it("leaves a question to the host", () => {
    const turn = fold(["Ready.", { kind: "question", question: { question: "Which order?" } }]);
    expect(turn).toEqual({ ...startReply("a1", "9:02"), text: "Ready." });
  });
});

describe("completeReply and cancelReply", () => {
  it("completes with the narration gone and nothing marked ended", () => {
    const turn = completeReply(fold([{ kind: "activity", text: "Writing." }, "Done."]));
    expect(turn).toMatchObject({ streaming: false, text: "Done." });
    expect(turn.activity).toBeUndefined();
    expect(turn.ended).toBeUndefined();
  });

  it("cancels with every unfinished step marked cancelled and the finished ones kept", () => {
    const turn = cancelReply(
      fold([
        { kind: "step", step: { id: "n", label: "North", status: "done", outcome: "84 matched." } },
        { kind: "step", step: { id: "s", label: "South", status: "running" } },
        { kind: "step", step: { id: "c", label: "Central", status: "pending" } },
      ]),
    );
    expect(turn.ended).toBe("cancelled");
    expect(turn.work?.steps.map((step) => step.status)).toEqual(["done", "cancelled", "cancelled"]);
  });
});

describe("workSummary", () => {
  it("counts the steps, the ones running, and the ones that did not finish", () => {
    expect(workSummary({ steps: [], logs: [], narration: [] })).toBe("0 steps");
    expect(
      workSummary({
        steps: [
          { id: "a", label: "A", status: "done" },
          { id: "b", label: "B", status: "running" },
          { id: "c", label: "C", status: "failed" },
          { id: "d", label: "D", status: "cancelled" },
        ],
        logs: [],
        narration: [],
      }),
    ).toBe("4 steps · 1 running · 2 did not finish");
    expect(
      workSummary({ steps: [{ id: "a", label: "A", status: "done" }], logs: [], narration: [] }),
    ).toBe("1 step");
  });
});
