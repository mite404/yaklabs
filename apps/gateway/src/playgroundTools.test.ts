import { describe, expect, it } from "vitest";
import { BAR_CARD } from "./playgroundTestKit";
import {
  initialTurn,
  narrate,
  translateToolUse,
  type ToolCall,
  type Translation,
} from "./playgroundTools";

const call = (name: string, value: unknown, id = "t1_0"): ToolCall => ({
  id,
  name,
  input: { ok: true, value },
});

// Runs calls one after another, as a turn would, and returns every translation.
const run = (calls: readonly ToolCall[]): Translation[] => {
  const translations: Translation[] = [];
  for (const next of calls)
    translations.push(translateToolUse(translations.at(-1)?.state ?? initialTurn, next));
  return translations;
};

// A translation's tool_result as the model reads it; a question has none.
const reply = (translation: Translation | undefined) => {
  const result = translation?.result;
  if (result === undefined || result === "asked") return { isError: false, text: "" };
  const text = typeof result.content === "string" ? result.content : "";
  return { isError: result.is_error === true, text };
};

// The turn after every translation in `translations`.
const stateAfter = (translations: readonly Translation[]) =>
  translations.at(-1)?.state ?? initialTurn;

const oneValueTrend = {
  ...BAR_CARD,
  component: "LineChart",
  props: { ...BAR_CARD.props, variant: "trend", rows: [{ label: "Mon", value: 12 }] },
};

describe("translateToolUse rejects", () => {
  it("a tool's second invalid input in a turn and asks for prose", () => {
    const [first, second] = run([
      call("update_work", { workId: "Bad Id" }),
      call("update_work", {}),
    ]);

    expect(first?.events).toEqual([]);
    expect(reply(first).isError).toBe(true);
    expect(reply(first).text).not.toContain("prose");
    expect(reply(second).text).toMatch(/Answer in prose instead\.$/);
  });

  it("an unknown tool as an error naming the real ones", () => {
    const [only] = run([call("draw_chart", {})]);

    expect(reply(only).isError).toBe(true);
    expect(reply(only).text).toContain("show_card");
  });

  it("a malformed question as an error the user never sees", () => {
    const [only] = run([call("ask_question", { question: { question: "What?" } })]);

    expect(only?.events).toEqual([]);
    expect(reply(only).isError).toBe(true);
  });
});

describe("translateToolUse limits", () => {
  it("a turn to six distinct cards, while an update by cardId still goes through", () => {
    const cards = ["a", "b", "c", "d", "e", "f", "g"].map((cardId) =>
      call("show_card", { cardId, card: BAR_CARD }),
    );
    const results = run([...cards, call("show_card", { cardId: "a", card: BAR_CARD })]);

    expect(results[6]?.events).toEqual([]);
    expect(reply(results[6])).toEqual({ isError: true, text: "card limit reached" });
    expect(results[7]?.events).toMatchObject([{ type: "card", cardId: "a" }]);
  });

  it("a turn to sixteen tool calls", () => {
    const results = run(
      Array.from({ length: 17 }, () => call("report_failure", { limitation: "No data." })),
    );

    expect(results[15]?.events).toHaveLength(1);
    expect(results[16]?.events).toEqual([]);
    expect(reply(results[16]).isError).toBe(true);
  });
});

describe("translateToolUse shows", () => {
  it("a one-value trend as a table with its reason", () => {
    const [only] = run([call("show_card", { cardId: "trend", card: oneValueTrend })]);

    expect(only?.events).toMatchObject([{ type: "card", selection: { component: "DataTable" } }]);
    expect(reply(only).text).toMatch(/^shown as a table: A trend needs at least two known/);
  });

  it("a failure with its recovery prompt and a fixed send label", () => {
    const [only] = run([
      call("report_failure", {
        limitation: "I cannot fetch data.",
        recovery_prompt: "Use these numbers.",
      }),
    ]);

    expect(only?.events).toEqual([
      {
        type: "failure",
        seq: 0,
        workId: null,
        limitation: "I cannot fetch data.",
        recovery: { label: "Send this", prompt: "Use these numbers." },
      },
    ]);
  });

  it("narration only for the most recent running work", () => {
    const turn = run([
      call("update_work", { workId: "one", label: "First", status: "running" }),
      call("update_work", { workId: "two", label: "Second", status: "running" }),
      call("report_outcome", { workId: "two", result: "Done.", evidence: [] }),
    ]);

    expect(narrate(stateAfter(turn), ["r1b0"])).toEqual([
      { type: "narration", blockId: "r1b0", workId: "one" },
    ]);
    expect(narrate(initialTurn, ["r1b0"])).toEqual([]);
  });
});
