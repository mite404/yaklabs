import { countWords, revealBlocks, type Block } from "./quiet-prose";
import { CHILD_LABELS, childOutcome, draftBlocks, findingBlocks } from "./content";
import {
  DRAFTING_MS,
  FINDING_MS,
  isAutoStage,
  type ChildKey,
  type ChildStatus,
  type Choice,
  type DemoState,
  type Stage,
} from "./state";

export type WorkingChild = {
  key: ChildKey;
  label: string;
  status: ChildStatus;
  running: boolean;
  outcome?: string;
};

/** Shaped to match the catalog's own `RecapItem` (ADR-018): structured outcomes, never prose
 * written after the fact. Used only behind the explicit "Preview return recap" simulation. */
export type RecapItem = { text: string; turnId: string };

/** Where the awaiting question stands: never asked yet, on screen waiting for an answer,
 * answered (drafting or complete), or declined without an answer. */
export type QuestionState = "absent" | "open" | "answered" | "skipped";

export type ViewModel = {
  /** Progress narration (ADR-139): shown only while the agent is actively selecting or
   * checking, gone once a finished response takes its place. */
  working?: { text: string; children: WorkingChild[] };
  /** Every child's status and outcome, retained for the sidebar across the whole run -
   * independent of whether `working` is shown. May be the same array `working.children` holds. */
  children: WorkingChild[];
  /** Narration labels already superseded by a later one, oldest first, kept even after
   * `working` itself disappears. */
  history: string[];
  /** Whether the agent is doing something on its own right now, with no user action pending. */
  busy: boolean;
  /** Whether pausing means anything right now - the same stages as `busy`, since idle, awaiting
   * and the terminal stages have no clock running to pause. */
  canPause: boolean;
  /** The finished finding, streaming in or complete; undefined until it starts. */
  finding?: { blocks: Block[]; complete: boolean };
  /** Set from the moment a child's evidence check fails, and stays set through the run's end.
   * Describes only the missing category's own data, never a claim that the whole run failed. */
  failure?: { title: string; detail: string };
  /** Whether the awaiting card should be on screen. */
  awaiting: boolean;
  questionState: QuestionState;
  /** What to echo back once the user has chosen or typed something. */
  echo?: string;
  /** The finished draft, streaming in or complete; undefined until a choice starts it. */
  draft?: { blocks: Block[] };
  skipped: boolean;
  complete: boolean;
  /** Every child's status, for the sidebar, independent of whether `working` is shown. */
  childStatus: Record<ChildKey, ChildStatus>;
  /** What a return recap would report so far - only ever shown under the explicit simulation. */
  recapItems: RecapItem[];
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

// Floors rather than rounds up, so the very last word stays hidden until `frac` actually
// reaches 1 - ceil would round a near-complete fraction up to the full count one tick early.
// A tiny positive fraction still floors to 0, so it is clamped up to 1 to keep the immediate
// reveal a stage starts with; a single-word block has no partial state, so it waits for 1.
function wordBudget(blocks: Block[], frac: number): number {
  const total = countWords(blocks);
  const clamped = clamp01(frac);
  if (clamped >= 1) return total;
  if (clamped <= 0) return 0;
  return Math.min(total - 1, Math.max(1, Math.floor(total * clamped)));
}

const NARRATION_ORDER: [Stage, string][] = [
  ["thinking", "Thinking."],
  ["selecting", "Selecting the support records."],
  ["checking", "Checking this week's workload and open issues."],
];

function workingText(stage: Stage): string | undefined {
  return NARRATION_ORDER.find(([narrated]) => narrated === stage)?.[1];
}

// Every narration label the run has already moved past, in order - the current one (if any)
// is still in `working.text`, not here, so a label only ever appears once it is superseded.
function narrationHistory({ stage, scenario }: DemoState): string[] {
  if (stage === "idle") return [];
  if (stage === "failed" && scenario === "reply-fails") return [NARRATION_ORDER[0][1]];
  const stageIndex = NARRATION_ORDER.findIndex(([narrated]) => narrated === stage);
  const passedCount = stageIndex === -1 ? NARRATION_ORDER.length : stageIndex;
  return NARRATION_ORDER.slice(0, passedCount).map(([, label]) => label);
}

function echoFor(choice: Choice): string {
  if (choice.kind === "billing") return 'You chose "Billing first."';
  if (choice.kind === "oldest") return 'You chose "Oldest first."';
  return `You typed: "${choice.text}"`;
}

const CHILD_KEYS: ChildKey[] = ["workload", "issues"];

function childrenView(state: DemoState): WorkingChild[] {
  return CHILD_KEYS.map((key) => {
    const status = state.children[key];
    return {
      key,
      label: CHILD_LABELS[key],
      status,
      running: state.stage === "checking" && status === "running",
      outcome: status === "done" ? childOutcome[key] : undefined,
    };
  });
}

// Visible the moment any child fails, not only once the run reaches its terminal `failed`
// stage - the sidebar should say so as soon as it is true. Names only the missing category:
// the rest of the run keeps going independently, so this must never read as a whole-run failure.
function failureFor(state: DemoState, children: WorkingChild[]): ViewModel["failure"] {
  if (state.stage === "interrupted") {
    return {
      title: "Reply interrupted",
      detail:
        "This answer is incomplete. Your question and the text received so far are kept in this demo session.",
    };
  }
  if (state.stage === "failed" && state.scenario === "reply-fails") {
    return {
      title: "Reply could not start",
      detail: "Your question is still here. Try again when you're ready.",
    };
  }
  const failed = children.find((child) => child.status === "failed");
  if (!failed) return undefined;
  return {
    title: `${failed.label} unavailable`,
    detail:
      "The category breakdown is missing. I can't prioritize or draft the brief without it. The successful check is still available in Work details.",
  };
}

function questionStateFor(stage: Stage): QuestionState {
  if (stage === "awaiting") return "open";
  if (stage === "drafting" || stage === "complete") return "answered";
  if (stage === "skipped") return "skipped";
  return "absent";
}

function recapTextFor(choice: Choice): string {
  if (choice.kind === "billing") return "Drafted Monday's brief, billing first.";
  if (choice.kind === "oldest") return "Drafted Monday's brief, oldest first.";
  return `Drafted Monday's brief from your note: "${choice.text}".`;
}

/** Turns a `DemoState` into everything the page needs to render, with no DOM or timers of its
 * own: every field here is a pure function of the state (and the authored content it pairs with
 * by choice), so the same state always renders the same screen. */
export function viewModel(state: DemoState): ViewModel {
  const children = childrenView(state);
  const text = workingText(state.stage);
  const working = text === undefined ? undefined : { text, children };

  const findingStarted =
    state.stage === "finding" ||
    state.stage === "interrupted" ||
    state.stage === "awaiting" ||
    state.stage === "drafting" ||
    state.stage === "complete" ||
    state.stage === "skipped";
  const findingFrac =
    state.stage === "finding" || state.stage === "interrupted" ? state.elapsed / FINDING_MS : 1;
  const finding = findingStarted
    ? {
        blocks: revealBlocks(findingBlocks, wordBudget(findingBlocks, findingFrac)),
        complete: findingFrac >= 1,
      }
    : undefined;

  const draftFrac = state.stage === "drafting" ? state.elapsed / DRAFTING_MS : 1;
  const draft =
    state.choice !== undefined && (state.stage === "drafting" || state.stage === "complete")
      ? {
          blocks: revealBlocks(
            draftBlocks(state.choice),
            wordBudget(draftBlocks(state.choice), draftFrac),
          ),
        }
      : undefined;

  const recapItems: RecapItem[] = [];
  if (finding?.complete)
    recapItems.push({ text: "Checked this week's workload and open issues.", turnId: "finding" });
  if (state.stage === "complete" && state.choice)
    recapItems.push({ text: recapTextFor(state.choice), turnId: "draft" });
  if (state.stage === "skipped")
    recapItems.push({ text: "The draft was skipped; nothing was prepared.", turnId: "finding" });

  return {
    working,
    children,
    history: narrationHistory(state),
    busy: isAutoStage(state.stage),
    canPause: isAutoStage(state.stage),
    finding,
    failure: failureFor(state, children),
    awaiting: state.stage === "awaiting",
    questionState: questionStateFor(state.stage),
    echo: state.choice ? echoFor(state.choice) : undefined,
    draft,
    skipped: state.stage === "skipped",
    complete: state.stage === "complete",
    childStatus: state.children,
    recapItems,
  };
}
