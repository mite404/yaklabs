import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CatalogCard } from "./CatalogCard";
import { ComposeBox } from "./ComposeBox";
import { appendDictation } from "./dictation";
import { DictationModal, type DictationSource } from "./DictationModal";
import { Recap } from "./Recap";
import { shouldShowRecap } from "./recapRules";
import type { Thread, ThreadMessage } from "./thread";
import "./thread.css";

type UserMessage = Extract<ThreadMessage, { role: "user" }>;
type AgentMessage = Extract<ThreadMessage, { role: "agent" }>;

/** Whether the thread is still running, and when the user last sent something. */
export type ThreadActivity = { active: boolean; lastUserInputAt: number };

// How often the idle clock re-checks when time is live rather than fixed.
const CLOCK_TICK_MS = 30_000;
// How long a jumped-to turn stays highlighted so the eye can find it.
const FLASH_MS = 1200;

// The user's turn: a tinted bubble resting on the thread (ADR-025).
function UserTurn({ message }: { message: UserMessage }) {
  return (
    <article
      className="turn turn-user"
      data-turn-id={message.id}
      aria-label={`You, ${message.time}`}
    >
      <p>{message.text}</p>
      <time>{message.time}</time>
    </article>
  );
}

// The agent's turn: prose first, then an optional catalog card sized by the panel.
function AgentTurn({ message }: { message: AgentMessage }) {
  return (
    <article
      className="turn turn-agent"
      data-turn-id={message.id}
      aria-label={`Agent, ${message.time}`}
    >
      <p>{message.text}</p>
      {message.payload !== undefined && (
        <CatalogCard payload={message.payload} context="thread" />
      )}
    </article>
  );
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// A live clock, or a fixed one when the host passes `now` (stories and tests).
function useClock(now?: number): number {
  const [live, setLive] = useState(() => Date.now());
  useEffect(() => {
    if (now !== undefined) return;
    const id = window.setInterval(() => setLive(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, [now]);
  return now ?? live;
}

/**
 * A vertical chat thread column: header, scrolling turns, and a compose box that never moves.
 * Text is capped at `--thread-measure` (80ch) inside a `--thread-gutter` (20px) on each side,
 * and embedded catalog cards adapt to the panel's width through container queries.
 * When the thread is active and the user has been away for 10+ minutes, a recap of
 * recorded outcomes floats above the compose box (ADR-018).
 * @param width Panel width in px; omit to use the measure plus gutters.
 * @param activity Thread state that drives the recap; omit and no recap is shown.
 * @param now Fixed clock for deterministic stories and tests; omit for live time.
 * @param dictationSource Audio for dictation: simulated (default) or the real microphone.
 * @param startDictating Open with dictation already recording (stories).
 */
export function ChatThreadPanel({
  thread,
  width,
  activity,
  now,
  dictationSource = "simulated",
  startDictating = false,
}: {
  thread: Thread;
  width?: number;
  activity?: ThreadActivity;
  now?: number;
  dictationSource?: DictationSource;
  startDictating?: boolean;
}) {
  const clock = useClock(now);
  const [messages, setMessages] = useState(thread.messages);
  const [draft, setDraft] = useState("");
  const [lastInputAt, setLastInputAt] = useState(activity?.lastUserInputAt);
  const [dismissedAt, setDismissedAt] = useState<number>();
  const [peeking, setPeeking] = useState(false);
  const [dictating, setDictating] = useState(startDictating);
  const scroller = useRef<HTMLDivElement>(null);
  const recapSlot = useRef<HTMLDivElement>(null);

  const recapVisible =
    activity !== undefined &&
    lastInputAt !== undefined &&
    (thread.recap?.length ?? 0) > 0 &&
    shouldShowRecap({
      now: clock,
      lastUserInputAt: lastInputAt,
      active: activity.active,
      dismissedAt,
    });

  // Open at the latest turn, the way a returning user expects to land.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // The recap overlays the conversation, so reserve its height below the last turn,
  // keeping a reader who was at the bottom still at the bottom.
  useLayoutEffect(() => {
    const el = scroller.current;
    const slot = recapSlot.current;
    if (!el) return;
    if (!slot) {
      el.style.removeProperty("--recap-space");
      return;
    }
    const reserve = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 4;
      el.style.setProperty("--recap-space", `${slot.offsetHeight}px`);
      if (atBottom) el.scrollTop = el.scrollHeight;
    };
    reserve();
    const observer = new ResizeObserver(reserve);
    observer.observe(slot);
    return () => observer.disconnect();
  }, [recapVisible]);

  function send() {
    setMessages([
      ...messages,
      { id: `local-${messages.length}`, role: "user", text: draft.trim(), time: "now" },
    ]);
    setDraft("");
    setPeeking(false);
    setLastInputAt(clock);
  }

  // Closing dictation returns focus to the text it fed, so the user can keep editing.
  function endDictation(transcript?: string) {
    if (transcript !== undefined) setDraft((current) => appendDictation(current, transcript));
    setDictating(false);
    requestAnimationFrame(() =>
      scroller.current
        ?.closest(".thread-panel")
        ?.querySelector<HTMLTextAreaElement>(".compose-box textarea")
        ?.focus(),
    );
  }

  // Jump so the evidence lands vertically centered, every time (ADR-022 eye trace).
  function jump(turnId: string) {
    const turn = scroller.current?.querySelector<HTMLElement>(
      `[data-turn-id="${CSS.escape(turnId)}"]`,
    );
    if (!turn) return;
    turn.scrollIntoView({
      block: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    turn.dataset.flash = "true";
    window.setTimeout(() => delete turn.dataset.flash, FLASH_MS);
  }

  return (
    <section
      className="thread-panel"
      style={width ? { width } : undefined}
      aria-label={thread.title}
    >
      <header className="thread-header">
        <h2>{thread.title}</h2>
      </header>
      <div className="thread-scroll" ref={scroller}>
        {messages.map((message) =>
          message.role === "user" ? (
            <UserTurn key={message.id} message={message} />
          ) : (
            <AgentTurn key={message.id} message={message} />
          ),
        )}
      </div>
      <div className="thread-dock">
        {recapVisible && (
          <div className="recap-slot" ref={recapSlot}>
            <Recap
              items={thread.recap ?? []}
              idleMs={clock - (lastInputAt ?? clock)}
              collapsed={draft.trim() !== "" && !peeking}
              onExpand={() => setPeeking(true)}
              onDismiss={() => setDismissedAt(clock)}
              onJump={jump}
            />
          </div>
        )}
        <div className="thread-compose">
          <ComposeBox
            draft={draft}
            onDraftChange={(value) => {
              setDraft(value);
              if (!value.trim()) setPeeking(false);
            }}
            onSend={send}
            onDictate={() => setDictating(true)}
            disabled={dictating}
          />
        </div>
      </div>
      {dictating && (
        <DictationModal
          source={dictationSource}
          onCancel={() => endDictation()}
          onDone={(transcript) => endDictation(transcript)}
        />
      )}
    </section>
  );
}
