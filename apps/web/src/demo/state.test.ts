import { describe, expect, it } from "vitest";
import {
  CHECKING_MS,
  DRAFTING_MS,
  FINDING_MS,
  ISSUES_DONE_AT,
  SELECTING_MS,
  THINKING_MS,
  WORKLOAD_DONE_AT,
  initialState,
  isWorking,
  reduce,
  type DemoState,
} from "./state";

// Runs a whole action list from a blank state, in order.
function run(actions: Parameters<typeof reduce>[1][]): DemoState {
  return actions.reduce(reduce, initialState());
}

const tick = (dt: number) => ({ type: "tick" as const, dt });

describe("reduce", () => {
  it("ignores a tick before the run starts", () => {
    expect(run([tick(500)])).toEqual(initialState());
  });

  it("moves through thinking, selecting and checking on their own durations", () => {
    let state = run([{ type: "start" }]);
    expect(state.stage).toBe("thinking");
    state = reduce(state, tick(THINKING_MS - 1));
    expect(state.stage).toBe("thinking");
    state = reduce(state, tick(1));
    expect(state.stage).toBe("selecting");
    expect(state.elapsed).toBe(0);
    state = reduce(state, tick(SELECTING_MS));
    expect(state.stage).toBe("checking");
  });

  it("finishes each child at its own moment inside checking, concurrently", () => {
    let state = run([{ type: "start" }, tick(THINKING_MS), tick(SELECTING_MS)]);
    expect(state.stage).toBe("checking");
    expect(state.children).toEqual({ workload: "running", issues: "running" });
    state = reduce(state, tick(WORKLOAD_DONE_AT));
    expect(state.children).toEqual({ workload: "done", issues: "running" });
    state = reduce(state, tick(ISSUES_DONE_AT - WORKLOAD_DONE_AT));
    expect(state.children).toEqual({ workload: "done", issues: "done" });
    // Both stay done through the rest of checking and into finding.
    state = reduce(state, tick(CHECKING_MS - ISSUES_DONE_AT));
    expect(state.stage).toBe("finding");
    expect(state.children).toEqual({ workload: "done", issues: "done" });
  });

  it("lands on awaiting once finding runs out, and a tick there is a no-op", () => {
    const state = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
    ]);
    expect(state.stage).toBe("awaiting");
    expect(reduce(state, tick(10_000))).toEqual(state);
  });

  it("a large tick that spans several stages still lands correctly", () => {
    const state = run([
      { type: "start" },
      tick(THINKING_MS + SELECTING_MS + CHECKING_MS + FINDING_MS),
    ]);
    expect(state.stage).toBe("awaiting");
    expect(state.children).toEqual({ workload: "done", issues: "done" });
  });

  it("choose only takes effect while awaiting, and resets elapsed for drafting", () => {
    const beforeAwaiting = run([{ type: "start" }]);
    expect(reduce(beforeAwaiting, { type: "choose", choice: { kind: "billing" } })).toBe(
      beforeAwaiting,
    );

    const awaiting = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
    ]);
    const chosen = reduce(awaiting, { type: "choose", choice: { kind: "oldest" } });
    expect(chosen).toMatchObject({ stage: "drafting", elapsed: 0, choice: { kind: "oldest" } });
  });

  it("billing and oldest are distinct choices, and typed text is carried verbatim", () => {
    const awaiting = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
    ]);
    const billing = reduce(awaiting, { type: "choose", choice: { kind: "billing" } });
    const typed = reduce(awaiting, {
      type: "choose",
      choice: { kind: "typed", text: "close billing first" },
    });
    expect(billing.choice).toEqual({ kind: "billing" });
    expect(typed.choice).toEqual({ kind: "typed", text: "close billing first" });
  });

  it("drafting completes once its own duration is spent", () => {
    const awaiting = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
    ]);
    const drafting = reduce(awaiting, { type: "choose", choice: { kind: "billing" } });
    const mid = reduce(drafting, tick(DRAFTING_MS - 1));
    expect(mid.stage).toBe("drafting");
    const done = reduce(mid, tick(1));
    expect(done.stage).toBe("complete");
  });

  it("skip only takes effect while awaiting, and never produces a draft", () => {
    const beforeAwaiting = run([{ type: "start" }]);
    expect(reduce(beforeAwaiting, { type: "skip" })).toBe(beforeAwaiting);

    const awaiting = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
    ]);
    const skipped = reduce(awaiting, { type: "skip" });
    expect(skipped.stage).toBe("skipped");
    expect(skipped.choice).toBeUndefined();
    expect(reduce(skipped, tick(5000))).toEqual(skipped);
  });

  it("pause freezes elapsed time until resume", () => {
    let state = run([{ type: "start" }, tick(500)]);
    state = reduce(state, { type: "pause" });
    const paused = reduce(state, tick(10_000));
    expect(paused).toEqual(state);
    const resumed = reduce(paused, { type: "resume" });
    const advanced = reduce(resumed, tick(1));
    expect(advanced.elapsed).toBe(501);
  });

  it("replay resets every field, from any stage", () => {
    const complete = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
      { type: "choose", choice: { kind: "billing" } },
      tick(DRAFTING_MS),
    ]);
    expect(complete.stage).toBe("complete");
    expect(reduce(complete, { type: "replay" })).toEqual(initialState());
  });
});

describe("missing-issues scenario", () => {
  it("defaults to the normal scenario when start carries none", () => {
    const state = run([{ type: "start" }]);
    expect(state.scenario).toBe("normal");
  });

  it("keeps workload succeeding on its own schedule while issues fails on its own", () => {
    let state = run([
      { type: "start", scenario: "missing-issues" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
    ]);
    expect(state.stage).toBe("checking");
    state = reduce(state, tick(WORKLOAD_DONE_AT));
    expect(state.children).toEqual({ workload: "done", issues: "running" });
    state = reduce(state, tick(ISSUES_DONE_AT - WORKLOAD_DONE_AT));
    expect(state.children).toEqual({ workload: "done", issues: "failed" });
  });

  it("lands on a terminal failed stage once checking's own duration is spent", () => {
    const state = run([
      { type: "start", scenario: "missing-issues" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
    ]);
    expect(state.stage).toBe("failed");
    expect(state.children).toEqual({ workload: "done", issues: "failed" });
    // failed is terminal: a further tick is a no-op, same as complete/skipped.
    expect(reduce(state, tick(10_000))).toEqual(state);
  });

  it("never reaches finding, awaiting or drafting once issues has failed", () => {
    const state = run([
      { type: "start", scenario: "missing-issues" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
      tick(DRAFTING_MS),
    ]);
    expect(state.stage).toBe("failed");
  });

  it("the normal scenario is unaffected: issues still completes instead of failing", () => {
    const state = run([
      { type: "start", scenario: "normal" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
    ]);
    expect(state.stage).toBe("finding");
    expect(state.children).toEqual({ workload: "done", issues: "done" });
  });

  it("replay returns the pristine normal idle state, even after a missing-issues run", () => {
    const failed = run([
      { type: "start", scenario: "missing-issues" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
    ]);
    expect(reduce(failed, { type: "replay" })).toEqual(initialState());
  });
});

describe("reply interruption", () => {
  it("stops before text when the scripted connection fails", () => {
    const state = run([{ type: "start", scenario: "reply-fails" }, tick(THINKING_MS)]);
    expect(state.stage).toBe("failed");
    expect(state.children).toEqual({ workload: "pending", issues: "pending" });
    expect(reduce(state, tick(30_000))).toEqual(state);
  });

  it("keeps an interrupted answer at its last revealed position", () => {
    const state = run([
      { type: "start", scenario: "reply-interrupted" },
      tick(THINKING_MS + SELECTING_MS + CHECKING_MS + FINDING_MS / 2),
    ]);
    expect(state.stage).toBe("interrupted");
    expect(state.elapsed).toBe(FINDING_MS / 2);
    expect(reduce(state, tick(60_000))).toEqual(state);
    expect(reduce(state, { type: "choose", choice: { kind: "billing" } })).toEqual(state);
  });

  it("retries once without losing the interrupted attempt", () => {
    const interrupted = run([
      { type: "start", scenario: "reply-interrupted" },
      tick(THINKING_MS + SELECTING_MS + CHECKING_MS + FINDING_MS / 2),
    ]);
    const retry = reduce(interrupted, { type: "retry" });
    expect(retry.stage).toBe("thinking");
    expect(retry.scenario).toBe("normal");
    expect(retry.previous?.stage).toBe("interrupted");
    expect(retry.previous?.elapsed).toBe(3000);
    expect(reduce(retry, { type: "retry" })).toEqual(retry);
  });
});

describe("isWorking", () => {
  it("is true only for the stages that narrate active work", () => {
    expect(isWorking("thinking")).toBe(true);
    expect(isWorking("selecting")).toBe(true);
    expect(isWorking("checking")).toBe(true);
    expect(isWorking("idle")).toBe(false);
    expect(isWorking("finding")).toBe(false);
    expect(isWorking("awaiting")).toBe(false);
    expect(isWorking("drafting")).toBe(false);
    expect(isWorking("complete")).toBe(false);
    expect(isWorking("skipped")).toBe(false);
  });
});
