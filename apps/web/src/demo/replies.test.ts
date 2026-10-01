import { describe, expect, it } from "vitest";
import type { Clock } from "./clock";
import { play } from "./replies";
import { at } from "./script";

// A clock that records which kind of wait each pause asked for.
function recording(): { clock: Clock; waits: string[] } {
  const waits: string[] = [];
  const clock: Clock = {
    state: () => ({ rate: 2, paused: false }),
    subscribe: () => () => {},
    wait: (ms) => {
      waits.push(`wait ${ms}`);
      return Promise.resolve();
    },
    hold: (ms) => {
      waits.push(`hold ${ms}`);
      return Promise.resolve();
    },
    setRate: () => {},
    pause: () => {},
    resume: () => {},
  };
  return { clock, waits };
}

describe("a reply's pauses", () => {
  it("paces words on the rate and holds everything else at 1x", async () => {
    const { clock, waits } = recording();
    const events = [
      at(10, { kind: "block", block: "paragraph" }),
      at(20, { kind: "text", text: "one " }),
      at(30, "two"),
      at(40, { kind: "activity", text: "Checking" }),
    ];
    for await (const chunk of play(events, clock, new AbortController().signal, false)) void chunk;
    expect(waits).toEqual(["hold 10", "wait 20", "wait 30", "hold 40"]);
  });
});
