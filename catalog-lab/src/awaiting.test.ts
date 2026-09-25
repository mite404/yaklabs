import { expect, it } from "vitest";
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

it("names what broke in a malformed question, so the agent can ask another way", () => {
  const result = resolveAwaiting(threads.malformed.awaiting);
  expect(result.kind === "malformed" && result.reason).toMatch(/^answer\.placeholder: /);
});
