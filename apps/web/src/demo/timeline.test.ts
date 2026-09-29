import { describe, expect, it } from "vitest";
import { countWords } from "./quiet-prose";
import { childOutcome, draftBlocks, findingBlocks } from "./content";
import {
  CHECKING_MS,
  DRAFTING_MS,
  FINDING_MS,
  ISSUES_DONE_AT,
  SELECTING_MS,
  THINKING_MS,
  WORKLOAD_DONE_AT,
  initialState,
  reduce,
  type DemoState,
} from "./state";
import { viewModel } from "./timeline";

const tick = (dt: number) => ({ type: "tick" as const, dt });

function run(actions: Parameters<typeof reduce>[1][]): DemoState {
  return actions.reduce(reduce, initialState());
}

describe("viewModel", () => {
  it("shows nothing to reveal while idle", () => {
    const view = viewModel(initialState());
    expect(view.working).toBeUndefined();
    expect(view.finding).toBeUndefined();
    expect(view.awaiting).toBe(false);
    expect(view.draft).toBeUndefined();
  });

  it("narrates thinking, then selecting, then checking, with no finding yet", () => {
    const thinking = viewModel(run([{ type: "start" }]));
    expect(thinking.working?.text).toBe("Thinking.");
    expect(thinking.finding).toBeUndefined();

    const selecting = viewModel(run([{ type: "start" }, tick(THINKING_MS)]));
    expect(selecting.working?.text).toBe("Selecting the support records.");

    const checking = viewModel(run([{ type: "start" }, tick(THINKING_MS), tick(SELECTING_MS)]));
    expect(checking.working?.text).toContain("Checking");
  });

  it("shows each child running, then done with its own outcome, independently", () => {
    const state = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(WORKLOAD_DONE_AT),
    ]);
    const view = viewModel(state);
    const workload = view.working?.children.find((c) => c.key === "workload");
    const issues = view.working?.children.find((c) => c.key === "issues");
    expect(workload?.running).toBe(false);
    expect(workload?.outcome).toBeDefined();
    expect(issues?.running).toBe(true);
    expect(issues?.outcome).toBeUndefined();
  });

  it("drops the working narration once checking gives way to finding", () => {
    const view = viewModel(
      run([{ type: "start" }, tick(THINKING_MS), tick(SELECTING_MS), tick(CHECKING_MS)]),
    );
    expect(view.working).toBeUndefined();
    expect(view.finding).toBeDefined();
  });

  it("reveals the finding gradually, word by word, as elapsed grows within the stage", () => {
    const total = countWords(findingBlocks);
    const state = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
    ]);
    const early = viewModel(reduce(state, tick(1)));
    const mid = viewModel(reduce(state, tick(FINDING_MS / 2)));
    const late = viewModel(reduce(state, tick(FINDING_MS - 1)));
    const earlyWords = countWords(early.finding?.blocks ?? []);
    const midWords = countWords(mid.finding?.blocks ?? []);
    const lateWords = countWords(late.finding?.blocks ?? []);
    expect(earlyWords).toBeGreaterThan(0);
    expect(earlyWords).toBeLessThan(midWords);
    expect(midWords).toBeLessThan(lateWords);
    expect(lateWords).toBeLessThanOrEqual(total);
  });

  it("never shows an awaiting card, or any draft text, before the finding is done", () => {
    const state = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(1),
    ]);
    const view = viewModel(state);
    expect(view.awaiting).toBe(false);
    expect(view.draft).toBeUndefined();
  });

  it("keeps the finding's very last word hidden until the stage actually completes", () => {
    const total = countWords(findingBlocks);
    const state = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
    ]);
    const almostDone = viewModel(reduce(state, tick(FINDING_MS - 1)));
    expect(almostDone.finding?.complete).toBe(false);
    expect(countWords(almostDone.finding?.blocks ?? [])).toBeLessThan(total);
    const done = viewModel(reduce(state, tick(FINDING_MS)));
    expect(done.finding?.complete).toBe(true);
    expect(countWords(done.finding?.blocks ?? [])).toBe(total);
  });

  it("shows the awaiting card, fully-revealed finding, and no draft yet, once finding ends", () => {
    const state = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
    ]);
    const view = viewModel(state);
    expect(view.awaiting).toBe(true);
    expect(view.working).toBeUndefined();
    expect(view.finding?.complete).toBe(true);
    expect(countWords(view.finding?.blocks ?? [])).toBe(countWords(findingBlocks));
    expect(view.draft).toBeUndefined();
  });

  it("echoes the exact choice, and streams a draft that differs between billing and oldest", () => {
    const awaiting = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
    ]);
    const billing = viewModel(
      reduce(reduce(awaiting, { type: "choose", choice: { kind: "billing" } }), tick(DRAFTING_MS)),
    );
    const oldest = viewModel(
      reduce(reduce(awaiting, { type: "choose", choice: { kind: "oldest" } }), tick(DRAFTING_MS)),
    );
    expect(billing.echo).toContain("Billing first");
    expect(oldest.echo).toContain("Oldest first");
    expect(billing.draft?.blocks).not.toEqual(oldest.draft?.blocks);
  });

  it("echoes typed text verbatim", () => {
    const awaiting = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
    ]);
    const typed = viewModel(
      reduce(awaiting, { type: "choose", choice: { kind: "typed", text: "handle access first" } }),
    );
    expect(typed.echo).toBe('You typed: "handle access first"');
  });

  it("reveals the draft gradually and lands on the full text at completion", () => {
    const awaiting = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
    ]);
    const chosen = reduce(awaiting, { type: "choose", choice: { kind: "billing" } });
    const total = countWords(draftBlocks({ kind: "billing" }));
    const early = viewModel(reduce(chosen, tick(1)));
    const complete = viewModel(reduce(chosen, tick(DRAFTING_MS)));
    expect(countWords(early.draft?.blocks ?? [])).toBeGreaterThan(0);
    expect(countWords(early.draft?.blocks ?? [])).toBeLessThan(total);
    expect(countWords(complete.draft?.blocks ?? [])).toBe(total);
    expect(complete.complete).toBe(true);
  });

  it("shows only the skipped outcome when the user skips, never a draft", () => {
    const awaiting = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
    ]);
    const view = viewModel(reduce(awaiting, { type: "skip" }));
    expect(view.skipped).toBe(true);
    expect(view.draft).toBeUndefined();
    expect(view.awaiting).toBe(false);
  });

  it("keeps childStatus available even before checking starts or after everything finishes", () => {
    expect(viewModel(initialState()).childStatus).toEqual({
      workload: "pending",
      issues: "pending",
    });
    const done = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
      { type: "skip" },
    ]);
    expect(viewModel(done).childStatus).toEqual({ workload: "done", issues: "done" });
  });
});

describe("recapItems", () => {
  it("has nothing to report before the finding is done", () => {
    expect(viewModel(initialState()).recapItems).toEqual([]);
  });

  it("reports the check once the finding completes, and the draft once it completes", () => {
    const awaiting = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
    ]);
    expect(viewModel(awaiting).recapItems).toHaveLength(1);
    const complete = reduce(
      reduce(awaiting, { type: "choose", choice: { kind: "billing" } }),
      tick(DRAFTING_MS),
    );
    expect(viewModel(complete).recapItems).toHaveLength(2);
  });

  it("reports the skip instead of a draft", () => {
    const awaiting = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
    ]);
    const skipped = reduce(awaiting, { type: "skip" });
    expect(viewModel(skipped).recapItems).toHaveLength(2);
    expect(viewModel(skipped).recapItems.at(-1)?.text).toContain("skipped");
  });
});

describe("children", () => {
  it("is always present and keyed, even before checking ever starts", () => {
    const view = viewModel(initialState());
    expect(view.children).toEqual([
      { key: "workload", label: "Weekly workload", status: "pending", running: false },
      { key: "issues", label: "Open issues", status: "pending", running: false },
    ]);
  });

  it("shares its retained value with working.children while working is shown", () => {
    const state = run([{ type: "start" }, tick(THINKING_MS), tick(SELECTING_MS)]);
    const view = viewModel(state);
    expect(view.working?.children).toBe(view.children);
  });

  it("stays available with each child's final status once the run leaves checking", () => {
    const state = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
    ]);
    const view = viewModel(state);
    expect(view.working).toBeUndefined();
    expect(view.children).toEqual([
      {
        key: "workload",
        label: "Weekly workload",
        status: "done",
        outcome: childOutcome.workload,
        running: false,
      },
      {
        key: "issues",
        label: "Open issues",
        status: "done",
        outcome: childOutcome.issues,
        running: false,
      },
    ]);
  });
});

describe("history", () => {
  it("accumulates each narration label only once it has been superseded", () => {
    expect(viewModel(initialState()).history).toEqual([]);
    expect(viewModel(run([{ type: "start" }])).history).toEqual([]);
    expect(viewModel(run([{ type: "start" }, tick(THINKING_MS)])).history).toEqual(["Thinking."]);
    expect(
      viewModel(run([{ type: "start" }, tick(THINKING_MS), tick(SELECTING_MS)])).history,
    ).toEqual(["Thinking.", "Selecting the support records."]);
  });

  it("retains all three labels once working narration disappears, and keeps them to the end", () => {
    const expected = [
      "Thinking.",
      "Selecting the support records.",
      "Checking this week's workload and open issues.",
    ];
    const afterChecking = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
    ]);
    expect(viewModel(afterChecking).history).toEqual(expected);
    const complete = reduce(
      reduce(reduce(afterChecking, tick(FINDING_MS)), {
        type: "choose",
        choice: { kind: "billing" },
      }),
      tick(DRAFTING_MS),
    );
    expect(viewModel(complete).history).toEqual(expected);
  });
});

describe("busy and canPause", () => {
  it("are true only for the stages that advance on their own via tick", () => {
    const awaiting = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
    ]);
    const cases: [DemoState, boolean][] = [
      [initialState(), false],
      [run([{ type: "start" }]), true],
      [run([{ type: "start" }, tick(THINKING_MS)]), true],
      [run([{ type: "start" }, tick(THINKING_MS), tick(SELECTING_MS), tick(CHECKING_MS)]), true],
      [awaiting, false],
      [reduce(awaiting, { type: "choose", choice: { kind: "billing" } }), true],
      [
        reduce(
          reduce(awaiting, { type: "choose", choice: { kind: "billing" } }),
          tick(DRAFTING_MS),
        ),
        false,
      ],
      [reduce(awaiting, { type: "skip" }), false],
    ];
    for (const [state, expected] of cases) {
      expect(viewModel(state).busy).toBe(expected);
      expect(viewModel(state).canPause).toBe(expected);
    }
  });
});

describe("questionState", () => {
  it("moves from absent, to open, to answered - or to skipped instead", () => {
    expect(viewModel(initialState()).questionState).toBe("absent");
    const awaiting = run([
      { type: "start" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
    ]);
    expect(viewModel(run([{ type: "start" }])).questionState).toBe("absent");
    expect(viewModel(awaiting).questionState).toBe("open");
    expect(
      viewModel(reduce(awaiting, { type: "choose", choice: { kind: "billing" } })).questionState,
    ).toBe("answered");
    expect(
      viewModel(
        reduce(
          reduce(awaiting, { type: "choose", choice: { kind: "billing" } }),
          tick(DRAFTING_MS),
        ),
      ).questionState,
    ).toBe("answered");
    expect(viewModel(reduce(awaiting, { type: "skip" })).questionState).toBe("skipped");
  });
});

describe("the missing-issues scenario", () => {
  it("shows the failure as soon as issues fails, before checking's own duration ends", () => {
    const state = run([
      { type: "start", scenario: "missing-issues" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS - 1),
    ]);
    const view = viewModel(state);
    expect(state.stage).toBe("checking");
    expect(view.failure).toBeDefined();
    expect(view.failure?.title).toContain("Open issues");
    expect(view.failure?.detail).toMatch(/prioritiz|draft/iu);
    expect(view.failure?.detail).not.toMatch(/workload/iu);
    const workload = view.children.find((c) => c.key === "workload");
    const issues = view.children.find((c) => c.key === "issues");
    expect(workload?.status).toBe("done");
    expect(issues?.status).toBe("failed");
  });

  it("lands on the terminal failed stage with no finding, question or draft, once checking ends", () => {
    const state = run([
      { type: "start", scenario: "missing-issues" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
    ]);
    const view = viewModel(state);
    expect(state.stage).toBe("failed");
    expect(view.failure).toBeDefined();
    expect(view.working).toBeUndefined();
    expect(view.finding).toBeUndefined();
    expect(view.draft).toBeUndefined();
    expect(view.awaiting).toBe(false);
    expect(view.complete).toBe(false);
    expect(view.skipped).toBe(false);
    expect(view.questionState).toBe("absent");
    expect(view.busy).toBe(false);
    expect(view.canPause).toBe(false);
  });

  it("does not stop workload's own progress or invent a draft from the failed category", () => {
    const state = run([
      { type: "start", scenario: "missing-issues" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(WORKLOAD_DONE_AT),
    ]);
    const view = viewModel(state);
    const workload = view.children.find((c) => c.key === "workload");
    const issues = view.children.find((c) => c.key === "issues");
    expect(workload?.status).toBe("done");
    expect(workload?.outcome).toBe(childOutcome.workload);
    expect(issues?.status).toBe("running");
    expect(view.draft).toBeUndefined();
  });

  it("leaves the normal scenario's finding and draft untouched", () => {
    const awaiting = run([
      { type: "start", scenario: "normal" },
      tick(THINKING_MS),
      tick(SELECTING_MS),
      tick(CHECKING_MS),
      tick(FINDING_MS),
    ]);
    const view = viewModel(awaiting);
    expect(view.failure).toBeUndefined();
    expect(view.awaiting).toBe(true);
  });
});

describe("interrupted response presentation", () => {
  it("retains partial prose with an interruption label and no busy or decision state", () => {
    const state = run([
      { type: "start", scenario: "reply-interrupted" },
      tick(THINKING_MS + SELECTING_MS + CHECKING_MS + FINDING_MS),
    ]);
    const view = viewModel(state);
    expect(view.failure?.title).toBe("Reply interrupted");
    expect(view.finding?.blocks[0]).toEqual({
      kind: "paragraph",
      content: [
        { kind: "text", text: "The backlog fell from " },
        { kind: "strong", text: "46 cases Monday to 18 by Friday" },
        { kind: "text", text: ", and " },
        { kind: "strong", text: "12 of those 18" },
      ],
    });
    expect(view.finding?.complete).toBe(false);
    expect(view.busy).toBe(false);
    expect(view.awaiting).toBe(false);
  });

  it("labels a failure before text without inventing a partial answer", () => {
    const view = viewModel(run([{ type: "start", scenario: "reply-fails" }, tick(2000)]));
    expect(view.failure?.title).toBe("Reply could not start");
    expect(view.finding).toBeUndefined();
    expect(view.busy).toBe(false);
    expect(view.history).toEqual(["Thinking."]);
  });
});

// A sanity check that the constants actually order the way the scripted narration assumes.
describe("stage ordering", () => {
  it("finishes the workload check before the issues check", () => {
    expect(WORKLOAD_DONE_AT).toBeLessThan(ISSUES_DONE_AT);
    expect(ISSUES_DONE_AT).toBeLessThan(CHECKING_MS);
  });
});
