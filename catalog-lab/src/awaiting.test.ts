import { describe, expect, it } from "vitest";
import { resolveAwaiting } from "./awaiting";
import { threads } from "./thread";

const valid = threads.awaiting.awaiting as Record<string, unknown>;

// The card's question when approved, or undefined when it would never be shown.
function card(payload: unknown) {
  const result = resolveAwaiting(payload);
  return result.kind === "approved" ? result.question : undefined;
}

it("accepts the forecast question", () => {
  expect(card(valid)?.options).toHaveLength(1);
});

it("never shows a card for a question with no branch to choose", () => {
  expect(card({ ...valid, options: [] })).toBeUndefined();
});

it("never shows a card for a question carrying anything extra, such as styling", () => {
  expect(card({ ...valid, color: "red" })).toBeUndefined();
});

it("lets the agent word the way out, and falls back when it doesn't", () => {
  const { elsewhere, ...rest } = valid;
  expect(card(valid)?.elsewhere).toBe(elsewhere);
  expect(card(rest)?.elsewhere).toBeUndefined();
});

describe("every row stays short enough for four to look considered", () => {
  it("accepts a question of two short sentences", () => {
    expect(card({ ...valid, question: "The forecast view is missing. Should I request it?" })).toBeDefined();
  });

  it("sends a third sentence back to the agent to ask in the thread instead", () => {
    const question = "The forecast view is missing. It was never built. Should I request it?";
    expect(resolveAwaiting({ ...valid, question }).kind).toBe("malformed");
  });

  it("sends two long sentences back too", () => {
    const question =
      "The forecast view you asked for is missing from the catalog this quarter and next. Should I request it for the whole team now?";
    expect(resolveAwaiting({ ...valid, question }).kind).toBe("malformed");
  });

  it("holds option details to the same two short sentences", () => {
    const options = [{ label: "Request it", detail: "One. Two. Three." }];
    expect(resolveAwaiting({ ...valid, options }).kind).toBe("malformed");
  });

  it("keeps an option label to one line", () => {
    const options = [{ label: "Request a forecast view for every team and every week" }];
    expect(resolveAwaiting({ ...valid, options }).kind).toBe("malformed");
  });

  it("keeps the typed-answer prompt inside its one-line field", () => {
    const answer = { placeholder: "How many weeks ahead should the forecast go?" };
    expect(resolveAwaiting({ ...valid, answer }).kind).toBe("malformed");
  });
});

it("names what broke in a malformed question, so the agent can ask another way", () => {
  const result = resolveAwaiting(threads.malformed.awaiting);
  expect(result.kind === "malformed" && result.reason).toMatch(/^answer\.placeholder: /);
});
