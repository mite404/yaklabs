import { AgentTree, AwaitingInputCard, CatalogCard, Recap, UserTurn } from "@yaklabs/catalog";
import type { AwaitingInput } from "@yaklabs/catalog/awaiting";
import { Button } from "@yaklabs/ui/components/button";
import { useEffect, useReducer, useRef, useState } from "react";
import { useOutletContext } from "react-router";
import type { ThemeChoice } from "../theme";
import { QuietProse } from "./QuietProse";
import { Evidence } from "./Evidence";
import { Nav } from "./Nav";
import { useDemoClock } from "./clock";
import { reduce, initialState, type ChildKey, type Choice, type Scenario } from "./state";
import { viewModel } from "./timeline";
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
  const status = state.paused
    ? "Paused. Resume whenever you're ready."
    : (view.working?.text ??
      (view.busy ? "Writing your brief." : view.awaiting ? "Ready for your choice." : ""));

  // New turns land at the end automatically; a reader who scrolled up is left alone and offered
  // a way back instead.
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

  return (
    <div className="weekly-brief" data-paused={state.paused || undefined}>
      <header className="wb-titlebar chrome-surface">
        <span className="wb-titlebar-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <h1 className="wb-titlebar-title">Weekly brief</h1>
        <span className="wb-titlebar-badge">Scripted demo</span>
        <Button
          variant="ghost"
          size="sm"
          className="wb-theme-toggle"
          onClick={() => {
            const resolved = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
            theme.choose(resolved === "dark" ? "light" : "dark");
          }}
        >
          Toggle theme
        </Button>
      </header>
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
        <main className="wb-main" aria-label="Weekly brief conversation">
          <div className="wb-scroll" ref={scrollRef} onScroll={onScroll}>
            {state.stage === "idle" ? (
              <div className="wb-intro">
                <p className="wb-kicker">MONDAY, 9:00 AM</p>
                <h2>A clear start to the week.</h2>
                <p>Find out what changed, check the evidence, and choose what comes next.</p>
                <p className="wb-intro-note">About a minute. Take longer wherever you need.</p>
              </div>
            ) : (
              <>
                <UserTurn
                  message={{
                    id: "ask",
                    role: "user",
                    text: "Can you prepare Monday's support brief? Don't send anything.",
                    time: "9:00 AM",
                  }}
                />
                {previous?.finding && (
                  <article className="turn turn-agent wb-interrupted" data-turn-id="previous">
                    <p className="wb-turn-note">Earlier attempt · interrupted</p>
                    <QuietProse blocks={previous.finding.blocks} />
                    <p className="wb-turn-note">Incomplete answer, kept for reference.</p>
                  </article>
                )}
                {view.finding && (
                  <article
                    data-turn-id="finding"
                    className="turn turn-agent"
                    aria-busy={state.stage === "finding"}
                  >
                    <QuietProse blocks={view.finding.blocks} />
                    {view.finding.complete && (
                      <CatalogCard payload={workloadChart} context="thread" shareable={false} />
                    )}
                  </article>
                )}
                <div className="turn turn-agent wb-work-record">
                  <Evidence
                    open={workDetailsOpen}
                    onToggle={() => {
                      setShowJump(true);
                      setWorkDetailsOpen(!workDetailsOpen);
                    }}
                    workloadRef={workloadRef}
                    issuesRef={issuesRef}
                    checks={view.children}
                    history={view.history}
                  />
                </div>
                {view.failure && (
                  <section className="turn turn-agent wb-failure" aria-label={view.failure.title}>
                    <div className="quiet-prose" role="alert">
                      <p>
                        <strong>{view.failure.title}</strong>
                      </p>
                      <p>{view.failure.detail}</p>
                    </div>
                    {!view.busy && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowJump(false);
                          setWorkDetailsOpen(false);
                          dispatch({ type: "retry" });
                        }}
                      >
                        Try again
                      </Button>
                    )}
                  </section>
                )}
                {view.awaiting && (
                  <div className="turn turn-agent wb-decision">
                    <AwaitingInputCard
                      question={QUESTION}
                      onAnswer={(text) => {
                        setShowJump(false);
                        dispatch({ type: "choose", choice: choiceFor(text) });
                      }}
                      onElsewhere={() => {
                        dispatch({ type: "skip" });
                      }}
                    />
                  </div>
                )}
                {view.echo && (
                  <UserTurn
                    message={{ id: "echo", role: "user", text: view.echo, time: "9:02 AM" }}
                  />
                )}
                {view.draft && (
                  <article
                    data-turn-id="draft"
                    className="turn turn-agent"
                    aria-busy={!view.complete}
                  >
                    <QuietProse blocks={view.draft.blocks} />
                  </article>
                )}
                {view.skipped && <p className="turn turn-agent wb-skip">No draft was prepared.</p>}
                {view.busy && (
                  <div className="turn turn-agent wb-working">
                    <output className="wb-narration">
                      {!state.paused && <AgentTree label="Agent working" />}
                      <span>{status}</span>
                    </output>
                    {view.working && (
                      <p className="wb-next">
                        Then I’ll ask what to prioritize. Nothing will be sent.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          {showJump && (
            <button type="button" className="wb-jump-latest" onClick={jumpToLatest}>
              Jump to latest
            </button>
          )}
        </main>
        <footer className="wb-footer">
          <div className="wb-footer-measure">
            {recapPreview && (
              <>
                <p className="wb-recap-preview-note">
                  Simulation - a preview of a return recap. No time has actually passed.
                </p>
                <Recap
                  items={view.recapItems}
                  idleMs={25 * 60 * 1000}
                  collapsed={false}
                  onExpand={() => {}}
                  onDismiss={() => {
                    setRecapPreview(false);
                  }}
                  onJump={jumpToTurn}
                />
              </>
            )}
            <div className="wb-controls">
              {state.stage === "idle" && (
                <>
                  <label className="wb-scenario">
                    Demo scenario
                    <select
                      value={scenario}
                      onChange={(event) => {
                        const selected = SCENARIOS.find(
                          (item) => item.value === event.target.value,
                        );
                        if (selected) setScenario(selected.value);
                      }}
                    >
                      {SCENARIOS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    onClick={() => {
                      setShowJump(false);
                      dispatch({ type: "start", scenario });
                    }}
                  >
                    Start brief
                  </Button>
                </>
              )}
              {view.canPause && (
                <Button
                  variant="outline"
                  onClick={() => {
                    dispatch({ type: state.paused ? "resume" : "pause" });
                  }}
                >
                  {state.paused ? "Resume" : "Pause"}
                </Button>
              )}
              {state.stage !== "idle" && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setWorkDetailsOpen(false);
                    setRecapPreview(false);
                    setShowJump(false);
                    dispatch({ type: "replay" });
                  }}
                >
                  Replay
                </Button>
              )}
              {view.recapItems.length > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRecapPreview(!recapPreview);
                  }}
                >
                  Preview return recap
                </Button>
              )}
              {state.stage !== "idle" && (
                <span className="wb-footer-status">
                  {view.failure
                    ? "Needs attention"
                    : view.busy
                      ? state.paused
                        ? "Paused"
                        : "Running"
                      : view.awaiting
                        ? "Your choice"
                        : "Nothing sent"}
                </span>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
