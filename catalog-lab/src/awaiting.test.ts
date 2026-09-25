import { expect, it } from "vitest";
import { resolveAwaiting } from "./awaiting";
import { threads } from "./thread";

it("accepts the forecast question", () => {
  expect(resolveAwaiting(threads.awaiting.awaiting)?.options).toHaveLength(1);
});

it("drops a question with no branch to choose", () => {
  expect(resolveAwaiting({ ...threads.awaiting.awaiting as object, options: [] })).toBeUndefined();
});

it("drops a question carrying anything extra, such as styling", () => {
  expect(resolveAwaiting({ ...threads.awaiting.awaiting as object, color: "red" })).toBeUndefined();
});

it("lets the agent word the way out, and falls back when it doesn't", () => {
  const { elsewhere, ...rest } = threads.awaiting.awaiting as { elsewhere: string };
  expect(resolveAwaiting(threads.awaiting.awaiting)?.elsewhere).toBe(elsewhere);
  expect(resolveAwaiting(rest)?.elsewhere).toBeUndefined();
});
