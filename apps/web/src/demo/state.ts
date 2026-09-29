/** One child evidence check the agent runs while preparing the brief. */
export type ChildKey = "workload" | "issues";

/** A child check's own progress, independent of its sibling. */
export type ChildStatus = "pending" | "running" | "done" | "failed";

/** Which scripted run to play. `missing-issues` is deterministic, not a random failure roll -
 * the same category fails at the same moment every time, so it replays exactly like `normal`. */
export type Scenario =
  | "normal"
  | "missing-issues"
  | "reply-fails"
  | "reply-interrupted"
  | "invalid-card"
  | "save-fails";

/** How the user answered the awaiting question: a listed branch, or their own words. */
export type Choice = { kind: "billing" } | { kind: "oldest" } | { kind: "typed"; text: string };

/** One step of the scripted run. Only `tick` advances time, and only for stages with a duration.
 * `failed` is terminal, like `complete` and `skipped`: reached only when `checking` runs out of
 * time with a child in `failed`, and never followed by a finding, question or draft. */
export type Stage =
  | "idle"
  | "thinking"
  | "selecting"
  | "checking"
  | "finding"
  | "awaiting"
  | "drafting"
  | "complete"
  | "skipped"
  | "interrupted"
  | "failed";

/** The whole demo's state: deterministic, driven by elapsed time within the current stage. */
export type DemoState = {
  stage: Stage;
  /** Milliseconds elapsed since the current stage began. */
  elapsed: number;
  paused: boolean;
  scenario: Scenario;
  children: Record<ChildKey, ChildStatus>;
  choice?: Choice;
  previous?: DemoState;
};

export type DemoAction =
  | { type: "start"; scenario?: Scenario }
  | { type: "tick"; dt: number }
  | { type: "choose"; choice: Choice }
  | { type: "skip" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "retry" }
  | { type: "replay" };

export const THINKING_MS = 1200;
export const SELECTING_MS = 2000;
export const CHECKING_MS = 6000;
/** When each child finishes, measured from the start of `checking`. */
export const WORKLOAD_DONE_AT = 3200;
export const ISSUES_DONE_AT = 5200;
export const FINDING_MS = 6000;
export const DRAFTING_MS = 11_000;

export function initialState(): DemoState {
  return {
    stage: "idle",
    elapsed: 0,
    paused: false,
    scenario: "normal",
    children: { workload: "pending", issues: "pending" },
  };
}

// A stage's own duration, or undefined for a stage `tick` cannot advance on its own: idle waits
// for `start`, awaiting waits for `choose`/`skip`, and complete/skipped/failed are terminal.
function durationOf(stage: Stage): number | undefined {
  switch (stage) {
    case "thinking":
      return THINKING_MS;
    case "selecting":
      return SELECTING_MS;
    case "checking":
      return CHECKING_MS;
    case "finding":
      return FINDING_MS;
    case "drafting":
      return DRAFTING_MS;
    case "idle":
    case "awaiting":
    case "complete":
    case "skipped":
    case "interrupted":
    case "failed":
      return undefined;
  }
  return stage satisfies never;
}

/** Whether the current stage advances on its own via `tick`, without waiting for a user
 * action - the set the sidebar treats as the agent actively being busy. */
export function isAutoStage(stage: Stage): boolean {
  return durationOf(stage) !== undefined;
}

// The stage a duration-driven stage rolls into once its time is up. `checking` forks: a scenario
// that left a child `failed` ends the run there rather than moving on to a finding it can't
// honestly write - never a finding, question or draft built from data that never arrived.
function nextStage(stage: Stage, anyChildFailed: boolean): Stage {
  switch (stage) {
    case "thinking":
      return "selecting";
    case "selecting":
      return "checking";
    case "checking":
      return anyChildFailed ? "failed" : "finding";
    case "finding":
      return "awaiting";
    case "drafting":
      return "complete";
    case "idle":
    case "awaiting":
    case "complete":
    case "skipped":
    case "interrupted":
    case "failed":
      return stage;
  }
  return stage satisfies never;
}

function childrenAtElapsed(elapsed: number, scenario: Scenario): Record<ChildKey, ChildStatus> {
  return {
    workload: elapsed >= WORKLOAD_DONE_AT ? "done" : "running",
    issues:
      elapsed >= ISSUES_DONE_AT ? (scenario === "missing-issues" ? "failed" : "done") : "running",
  };
}

// Advances elapsed time within the current stage, rolling into later stages as their own
// durations are used up (a loop, not a single step, so a slow frame never leaves a stage stuck).
// Children only move while `checking` is the live stage; once it rolls into `finding` or `failed`
// they hold at whatever childrenAtElapsed last computed.
function tick(state: DemoState, dt: number): DemoState {
  if (state.paused || durationOf(state.stage) === undefined) return state;
  let stage = state.stage;
  let elapsed = state.elapsed + dt;
  let children = state.children;
  for (;;) {
    if (stage === "thinking" && state.scenario === "reply-fails" && elapsed >= THINKING_MS) {
      return { ...state, stage: "failed", elapsed: THINKING_MS };
    }
    if (
      stage === "finding" &&
      state.scenario === "reply-interrupted" &&
      elapsed >= FINDING_MS / 2
    ) {
      return { ...state, stage: "interrupted", elapsed: FINDING_MS / 2, children };
    }
    if (stage === "checking") children = childrenAtElapsed(elapsed, state.scenario);
    const duration = durationOf(stage);
    if (duration === undefined || elapsed < duration) break;
    elapsed -= duration;
    const anyChildFailed = Object.values(children).some((status) => status === "failed");
    stage = nextStage(stage, anyChildFailed);
  }
  return { ...state, stage, elapsed, children };
}

/** The whole demo's transition function: pure, so the same action sequence always replays the
 * same run. `tick` is the only action time drives; every other action is a user or host choice. */
export function reduce(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "start":
      return state.stage === "idle"
        ? { ...initialState(), stage: "thinking", scenario: action.scenario ?? "normal" }
        : state;
    case "tick":
      return tick(state, action.dt);
    case "choose":
      return state.stage === "awaiting"
        ? { ...state, stage: "drafting", elapsed: 0, choice: action.choice }
        : state;
    case "skip":
      return state.stage === "awaiting" ? { ...state, stage: "skipped" } : state;
    case "pause":
      return { ...state, paused: true };
    case "resume":
      return { ...state, paused: false };
    case "retry":
      return state.stage === "failed" || state.stage === "interrupted"
        ? { ...initialState(), stage: "thinking", previous: state }
        : state;
    case "replay":
      return initialState();
  }
  return action satisfies never;
}

/** Whether the agent is actively narrating work: the only window the sidebar and the
 * conversation show an {@link import("@yaklabs/catalog").AgentTree}. */
export function isWorking(stage: Stage): boolean {
  return stage === "thinking" || stage === "selecting" || stage === "checking";
}
