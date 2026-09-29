import { AgentTree, AwaitingInputCard, CatalogCard, Recap, UserTurn } from "@yaklabs/catalog";
import type { AwaitingInput } from "@yaklabs/catalog/awaiting";
import { Button } from "@yaklabs/ui/components/button";
import { useEffect, useReducer, useRef, useState, type ReactNode, type RefObject } from "react";
import { useOutletContext } from "react-router";
import type { ThemeChoice } from "../theme";
import { QuietProse } from "./QuietProse";
import { Evidence } from "./Evidence";
import { Nav } from "./Nav";
import { useDemoClock } from "./clock";
import {
  reduce,
  initialState,
  type ChildKey,
  type Choice,
  type DemoState,
  type Scenario,
} from "./state";
import { viewModel, type RecapItem, type ViewModel } from "./timeline";
import { workloadChart } from "./content";
import "./demo.css";

const QUESTION = {
  question: "How should Monday's brief prioritize the backlog?",
  options: [
    { label: "Billing first", detail: "Lead with the billing queue, the largest open category." },
    { label: "Oldest first", detail: "Lead with the longest-open category regardless of size." },
  ],
  answer: { placeholder: "Or type your own priority" },
  elsewhere: "Skip the draft for now",
} satisfies AwaitingInput;

const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: "normal", label: "Weekly brief" },
  { value: "reply-fails", label: "Reply cannot start" },
  { value: "reply-interrupted", label: "Reply interrupted" },
  { value: "missing-issues", label: "One check unavailable" },
];

// The awaiting card's own tile labels are the only automatic understanding this demo claims;
// anything else typed is carried through, never reinterpreted (see content.ts's draftBlocks).
function choiceFor(text: string): Choice {
  if (text === "Billing first") return { kind: "billing" };
  if (text === "Oldest first") return { kind: "oldest" };
  return { kind: "typed", text };
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// A brief highlight so a jump is felt, not just landed on; skipped under reduced motion.
function flash(element: HTMLElement | null): void {
  if (!element) return;
  element.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
  if (reducedMotion()) return;
  element.dataset.flash = "true";
  window.setTimeout(() => {
    delete element.dataset.flash;
  }, 1200);
}

function statusText(state: DemoState, view: ViewModel): string {
  if (state.paused) return "Paused. Resume whenever you're ready.";
  return view.working?.text ?? "Writing your brief.";
}

function Titlebar({ onToggleTheme }: { onToggleTheme: () => void }) {
  return (
    <header className="wb-titlebar chrome-surface">
      <span className="wb-titlebar-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <h1 className="wb-titlebar-title">Weekly brief</h1>
      <span className="wb-titlebar-badge">Scripted demo</span>
      <Button variant="ghost" size="sm" className="wb-theme-toggle" onClick={onToggleTheme}>
        Toggle theme
      </Button>
    </header>
  );
}

function IntroPanel() {
  return (
    <div className="wb-intro">
      <p className="wb-kicker">MONDAY, 9:00 AM</p>
      <h2>A clear start to the week.</h2>
      <p>Find out what changed, check the evidence, and choose what comes next.</p>
      <p className="wb-intro-note">About a minute. Take longer wherever you need.</p>
    </div>
  );
}

function PreviousAttempt({ finding }: { finding: ViewModel["finding"] }) {
  if (!finding) return null;
  return (
    <article className="turn turn-agent wb-interrupted" data-turn-id="previous">
      <p className="wb-turn-note">Earlier attempt · interrupted</p>
      <QuietProse blocks={finding.blocks} />
      <p className="wb-turn-note">Incomplete answer, kept for reference.</p>
    </article>
  );
}

function FindingTurn({ finding, busy }: { finding: ViewModel["finding"]; busy: boolean }) {
  if (!finding) return null;
  return (
    <article data-turn-id="finding" className="turn turn-agent" aria-busy={busy}>
      <QuietProse blocks={finding.blocks} />
      {finding.complete && (
        <CatalogCard payload={workloadChart} context="thread" shareable={false} />
      )}
    </article>
  );
}

function FailureSection({
  failure,
  busy,
  onRetry,
}: {
  failure: ViewModel["failure"];
  busy: boolean;
  onRetry: () => void;
}) {
  if (!failure) return null;
  return (
    <section className="turn turn-agent wb-failure" aria-label={failure.title}>
      <div className="quiet-prose" role="alert">
        <p>
          <strong>{failure.title}</strong>
        </p>
        <p>{failure.detail}</p>
      </div>
      {!busy && (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </section>
  );
}

function DecisionCard({
  awaiting,
  onAnswer,
  onElsewhere,
}: {
  awaiting: boolean;
  onAnswer: (text: string) => void;
  onElsewhere: () => void;
}) {
  if (!awaiting) return null;
  return (
    <div className="turn turn-agent wb-decision">
      <AwaitingInputCard question={QUESTION} onAnswer={onAnswer} onElsewhere={onElsewhere} />
    </div>
  );
}

function EchoTurn({ echo }: { echo: string | undefined }) {
  if (!echo) return null;
  return <UserTurn message={{ id: "echo", role: "user", text: echo, time: "9:02 AM" }} />;
}

function DraftTurn({ draft, complete }: { draft: ViewModel["draft"]; complete: boolean }) {
  if (!draft) return null;
  return (
    <article data-turn-id="draft" className="turn turn-agent" aria-busy={!complete}>
      <QuietProse blocks={draft.blocks} />
    </article>
  );
}

function SkippedNotice({ skipped }: { skipped: boolean }) {
  if (!skipped) return null;
  return <p className="turn turn-agent wb-skip">No draft was prepared.</p>;
}

function WorkingIndicator({ state, view }: { state: DemoState; view: ViewModel }) {
  if (!view.busy) return null;
  const status = statusText(state, view);
  return (
    <div className="turn turn-agent wb-working">
      <output className="wb-narration">
        {!state.paused && <AgentTree label="Agent working" />}
        <span>{status}</span>
      </output>
      {view.working && (
        <p className="wb-next">Then I’ll ask what to prioritize. Nothing will be sent.</p>
      )}
    </div>
  );
}

function RecapPreviewPanel({
  recapPreview,
  items,
  onDismiss,
  onJump,
}: {
  recapPreview: boolean;
  items: RecapItem[];
  onDismiss: () => void;
  onJump: (turnId: string) => void;
}) {
  if (!recapPreview) return null;
  return (
    <>
      <p className="wb-recap-preview-note">
        Simulation - a preview of a return recap. No time has actually passed.
      </p>
      <Recap
        items={items}
        idleMs={25 * 60 * 1000}
        collapsed={false}
        onExpand={() => {}}
        onDismiss={onDismiss}
        onJump={onJump}
      />
    </>
  );
}

function ScenarioPicker({
  scenario,
  onSelect,
  onStart,
}: {
  scenario: Scenario;
  onSelect: (value: Scenario) => void;
  onStart: () => void;
}) {
  return (
    <>
      <label className="wb-scenario">
        Demo scenario
        <select
          value={scenario}
          onChange={(event) => {
            const selected = SCENARIOS.find((item) => item.value === event.target.value);
            if (selected) onSelect(selected.value);
          }}
        >
          {SCENARIOS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <Button onClick={onStart}>Start brief</Button>
    </>
  );
}

function footerStatusLabel(
  failure: ViewModel["failure"],
  busy: boolean,
  busyLabel: string,
  awaiting: boolean,
): string {
  if (failure) return "Needs attention";
  if (busy) return busyLabel;
  if (awaiting) return "Your choice";
  return "Nothing sent";
}

function FooterStatusText({
  visible,
  failure,
  busy,
  paused,
  awaiting,
}: {
  visible: boolean;
  failure: ViewModel["failure"];
  busy: boolean;
  paused: boolean;
  awaiting: boolean;
}) {
  if (!visible) return null;
  return (
    <span className="wb-footer-status">
      {footerStatusLabel(failure, busy, paused ? "Paused" : "Running", awaiting)}
    </span>
  );
}

function ConversationTurns({
  state,
  view,
  previous,
  workloadRef,
  issuesRef,
  workDetailsOpen,
  onToggleWorkDetails,
  onRetry,
  onAnswer,
  onElsewhere,
}: {
  state: DemoState;
  view: ViewModel;
  previous: ViewModel | undefined;
  workloadRef: RefObject<HTMLDivElement | null>;
  issuesRef: RefObject<HTMLDivElement | null>;
  workDetailsOpen: boolean;
  onToggleWorkDetails: () => void;
  onRetry: () => void;
  onAnswer: (text: string) => void;
  onElsewhere: () => void;
}) {
  return (
    <>
      <UserTurn
        message={{
          id: "ask",
          role: "user",
          text: "Can you prepare Monday's support brief? Don't send anything.",
          time: "9:00 AM",
        }}
      />
      <PreviousAttempt finding={previous?.finding} />
      <FindingTurn finding={view.finding} busy={state.stage === "finding"} />
      <div className="turn turn-agent wb-work-record">
        <Evidence
          open={workDetailsOpen}
          onToggle={onToggleWorkDetails}
          workloadRef={workloadRef}
          issuesRef={issuesRef}
          checks={view.children}
          history={view.history}
        />
      </div>
      <FailureSection failure={view.failure} busy={view.busy} onRetry={onRetry} />
      <DecisionCard awaiting={view.awaiting} onAnswer={onAnswer} onElsewhere={onElsewhere} />
      <EchoTurn echo={view.echo} />
      <DraftTurn draft={view.draft} complete={view.complete} />
      <SkippedNotice skipped={view.skipped} />
      <WorkingIndicator state={state} view={view} />
    </>
  );
}

function PauseControl({
  canPause,
  paused,
  onToggle,
}: {
  canPause: boolean;
  paused: boolean;
  onToggle: () => void;
}) {
  if (!canPause) return null;
  return (
    <Button variant="outline" onClick={onToggle}>
      {paused ? "Resume" : "Pause"}
    </Button>
  );
}

function RunControls({
  state,
  view,
  onPauseToggle,
  onReplay,
  onToggleRecapPreview,
}: {
  state: DemoState;
  view: ViewModel;
  onPauseToggle: () => void;
  onReplay: () => void;
  onToggleRecapPreview: () => void;
}) {
  const started = state.stage !== "idle";
  return (
    <>
      <PauseControl canPause={view.canPause} paused={state.paused} onToggle={onPauseToggle} />
      {started && (
        <Button variant="outline" onClick={onReplay}>
          Replay
        </Button>
      )}
      {view.recapItems.length > 0 && (
        <Button variant="ghost" onClick={onToggleRecapPreview}>
          Preview return recap
        </Button>
      )}
      <FooterStatusText
        visible={started}
        failure={view.failure}
        busy={view.busy}
        paused={state.paused}
        awaiting={view.awaiting}
      />
    </>
  );
}

function Transcript({
  started,
  children,
  scrollRef,
  showJump,
  onScroll,
  onJumpLatest,
}: {
  started: boolean;
  children: ReactNode;
  scrollRef: RefObject<HTMLDivElement | null>;
  showJump: boolean;
  onScroll: () => void;
  onJumpLatest: () => void;
}) {
  return (
    <main className="wb-main" aria-label="Weekly brief conversation">
      <div className="wb-scroll" ref={scrollRef} onScroll={onScroll}>
        {started ? children : <IntroPanel />}
      </div>
      {showJump && (
        <button type="button" className="wb-jump-latest" onClick={onJumpLatest}>
          Jump to latest
        </button>
      )}
    </main>
  );
}

function BriefFooter({
  recapPreview,
  recapItems,
  onDismissRecap,
  onJumpTurn,
  state,
  view,
  scenario,
  onScenarioChange,
  onStart,
  onPauseToggle,
  onReplay,
  onToggleRecapPreview,
}: {
  recapPreview: boolean;
  recapItems: RecapItem[];
  onDismissRecap: () => void;
  onJumpTurn: (turnId: string) => void;
  state: DemoState;
  view: ViewModel;
  scenario: Scenario;
  onScenarioChange: (value: Scenario) => void;
  onStart: () => void;
  onPauseToggle: () => void;
  onReplay: () => void;
  onToggleRecapPreview: () => void;
}) {
  return (
    <footer className="wb-footer">
      <div className="wb-footer-measure">
        <RecapPreviewPanel
          recapPreview={recapPreview}
          items={recapItems}
          onDismiss={onDismissRecap}
          onJump={onJumpTurn}
        />
        <div className="wb-controls">
          {state.stage === "idle" && (
            <ScenarioPicker scenario={scenario} onSelect={onScenarioChange} onStart={onStart} />
          )}
          <RunControls
            state={state}
            view={view}
            onPauseToggle={onPauseToggle}
            onReplay={onReplay}
            onToggleRecapPreview={onToggleRecapPreview}
          />
        </div>
      </div>
    </footer>
  );
}

// New turns land at the end automatically; a reader who scrolled up is left alone and offered
// a way back instead. Bundled as a hook so its effect and the jump helpers that share its refs
// stay lifecycle-attached to the component that owns those refs, without living in its body.
function useTranscriptNav({
  scrollRef,
  workloadRef,
  issuesRef,
  showJump,
  setShowJump,
  setWorkDetailsOpen,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  workloadRef: RefObject<HTMLDivElement | null>;
  issuesRef: RefObject<HTMLDivElement | null>;
  showJump: boolean;
  setShowJump: (value: boolean) => void;
  setWorkDetailsOpen: (value: boolean) => void;
}) {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || showJump) return;
    el.scrollTo({ top: el.scrollHeight });
  });

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 48);
  }

  function jumpToLatest() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion() ? "auto" : "smooth" });
  }

  function jumpToTurn(turnId: string) {
    flash(scrollRef.current?.querySelector<HTMLElement>(`[data-turn-id="${turnId}"]`) ?? null);
  }

  function jumpToChild(key: ChildKey) {
    setShowJump(true);
    setWorkDetailsOpen(true);
    requestAnimationFrame(() => {
      flash(key === "workload" ? workloadRef.current : issuesRef.current);
    });
  }

  return { onScroll, jumpToLatest, jumpToTurn, jumpToChild };
}

/**
 * The scripted weekly-brief demo (ADR-137 through ADR-140): a nontechnical teammate asks their
 * assistant to prepare Monday's support brief, sees the concurrent checks that back the finding,
 * makes one real choice, and gets an honest draft - all from a deterministic timeline, nothing
 * sent anywhere. State lives in `reduce` (state.ts); what to show is `viewModel` (timeline.ts);
 * this component only wires a clock to the first, and the second to the screen.
 */
export default function WeeklyBriefDemo() {
  const theme = useOutletContext<ThemeChoice>();
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  useDemoClock((dt) => {
    dispatch({ type: "tick", dt });
  });
  const view = viewModel(state);

  const scrollRef = useRef<HTMLDivElement>(null);
  const workloadRef = useRef<HTMLDivElement>(null);
  const issuesRef = useRef<HTMLDivElement>(null);
  const [workDetailsOpen, setWorkDetailsOpen] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [recapPreview, setRecapPreview] = useState(false);
  const [scenario, setScenario] = useState<Scenario>("normal");
  const previous = state.previous && viewModel(state.previous);

  const { onScroll, jumpToLatest, jumpToTurn, jumpToChild } = useTranscriptNav({
    scrollRef,
    workloadRef,
    issuesRef,
    showJump,
    setShowJump,
    setWorkDetailsOpen,
  });

  function handleToggleTheme() {
    const resolved = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    theme.choose(resolved === "dark" ? "light" : "dark");
  }

  function handleStart() {
    setShowJump(false);
    dispatch({ type: "start", scenario });
  }

  return (
    <div className="weekly-brief" data-paused={state.paused || undefined}>
      <Titlebar onToggleTheme={handleToggleTheme} />
      <p className="wb-disclosure">
        Scripted demo · Sample support data. Nothing is sent or changed outside this page.
      </p>
      <div className="wb-body">
        <Nav
          working={view.busy && !state.paused}
          childStatus={view.childStatus}
          started={state.stage !== "idle"}
          onJumpMain={() => {
            jumpToTurn("ask");
          }}
          onJumpChild={jumpToChild}
        />
        <Transcript
          started={state.stage !== "idle"}
          scrollRef={scrollRef}
          showJump={showJump}
          onScroll={onScroll}
          onJumpLatest={jumpToLatest}
        >
          <ConversationTurns
            state={state}
            view={view}
            previous={previous}
            workloadRef={workloadRef}
            issuesRef={issuesRef}
            workDetailsOpen={workDetailsOpen}
            onToggleWorkDetails={() => {
              setShowJump(true);
              setWorkDetailsOpen(!workDetailsOpen);
            }}
            onRetry={() => {
              setShowJump(false);
              setWorkDetailsOpen(false);
              dispatch({ type: "retry" });
            }}
            onAnswer={(text) => {
              setShowJump(false);
              dispatch({ type: "choose", choice: choiceFor(text) });
            }}
            onElsewhere={() => {
              dispatch({ type: "skip" });
            }}
          />
        </Transcript>
        <BriefFooter
          recapPreview={recapPreview}
          recapItems={view.recapItems}
          onDismissRecap={() => {
            setRecapPreview(false);
          }}
          onJumpTurn={jumpToTurn}
          state={state}
          view={view}
          scenario={scenario}
          onScenarioChange={setScenario}
          onStart={handleStart}
          onPauseToggle={() => {
            dispatch({ type: state.paused ? "resume" : "pause" });
          }}
          onReplay={() => {
            setWorkDetailsOpen(false);
            setRecapPreview(false);
            setShowJump(false);
            dispatch({ type: "replay" });
          }}
          onToggleRecapPreview={() => {
            setRecapPreview(!recapPreview);
          }}
        />
      </div>
    </div>
  );
}
