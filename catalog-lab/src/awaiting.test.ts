import { expect, it } from "vitest";
import { resolveAwaiting } from "./awaiting";
import { threads } from "./thread";

it("accepts the forecast question", () => {
  expect(resolveAwaiting(threads.awaiting.awaiting)?.options).toHaveLength(1);
});

it("drops a question with no branch to choose", () => {
  expect(resolveAwaiting({ ...threads.awaiting.awaiting as object, options: [] })).toBeUndefined();
});

it("drops a question carrying anything extra, such as its own escape option", () => {
  expect(
    resolveAwaiting({ ...threads.awaiting.awaiting as object, dismiss: "Chat about something else" }),
  ).toBeUndefined();
});
