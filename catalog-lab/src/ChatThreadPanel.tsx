import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AwaitingInputCard } from "./AwaitingInputCard";
import { resolveAwaiting, type AwaitingInput } from "./awaiting";
import { CatalogCard } from "./CatalogCard";
import { ChartGlyph, ComposeBox } from "./ComposeBox";
import { appendDictation } from "./dictation";
import { DictationModal, type DictationSource } from "./DictationModal";
import { InteractiveCard } from "./InteractiveCard";
import { resolveInteractive, type CardAttachment } from "./interactive";
import { Recap } from "./Recap";
import { shouldShowRecap } from "./recapRules";
import type { Thread, ThreadMessage } from "./thread";
import { centerInScroller, keepExpansionsInView } from "./threadReveal";
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
      {message.attachments && message.attachments.length > 0 && (
        <ul className="sent-context" aria-label="Sent with this message">
          {message.attachments.map((item) => (
            <li key={item.turnId} className="context-chip">
              <ChartGlyph />
              {item.label}
            </li>
          ))}
        </ul>
      )}
      <time>{message.time}</time>
    </article>
  );
}

// Time between streamed words: fast enough to read as live, slow enough to see.
const STREAM_WORD_MS = 45;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// A reply that arrives word by word. Screen readers get the whole sentence once, not a
// word at a time; reduced motion shows it whole.
function StreamingText({ text }: { text: string }) {
  const words = text.split(" ");
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) return setShown(words.length);
    const id = window.setInterval(
      () => setShown((count) => (count >= words.length ? count : count + 1)),
      STREAM_WORD_MS,
    );
    return () => window.clearInterval(id);
  }, [words.length]);
  return (
    <p>
      <span className="visually-hidden">{text}</span>
      <span aria-hidden="true">{words.slice(0, shown).join(" ")}</span>
    </p>
  );
}

// The agent's turn: prose first, then an optional catalog card sized by the panel.
function AgentTurn({
  message,
  onChoose,
}: {
  message: AgentMessage;
  onChoose: (attachment: CardAttachment) => void;
}) {
  return (
    <article
      className="turn turn-agent"
      data-turn-id={message.id}
      aria-label={`Agent, ${message.time}`}
    >
      {message.stream ? <StreamingText text={message.text} /> : <p>{message.text}</p>}
      {message.payload !== undefined && (
        <CatalogCard payload={message.payload} context="thread" />
      )}
      {message.interactive !== undefined && (
        <InteractiveCard payload={message.interactive} turnId={message.id} onChoose={onChoose} />
      )}
    </article>
  );
}

// What the agent last saw on each interactive card: the measure it chose itself.
function initialReported(messages: ThreadMessage[]): Record<string, string> {
  const seen: Record<string, string> = {};
  for (const message of messages) {
    if (message.role !== "agent" || message.interactive === undefined) continue;
    const result = resolveInteractive(message.interactive);
    if (result.kind !== "approved") continue;
    const { stops, initial } = result.selection.props.control;
    seen[message.id] = stops.find((stop) => stop.id === initial)?.label ?? "";
  }
  return seen;
}

// Lab-only stand-in for the agent, so the round trip is visible without a model.
function simulatedReply(attachments: CardAttachment[]): string {
  const views = attachments.map((item) => item.label).join(" and ");
  return `Answering about ${views}, the view you set on the card. Saturday leads at every level, so the weekend carries the week.`;
}

// Lab-only stand-in for the agent picking up after the user answers its question.
function simulatedAnswerReply(answer: string): string {
  return `Got it: "${answer}". Carrying on from there.`;
}

// Lab-only stand-in for the agent receiving a validation error for its question (ADR-040):
// it asks in plain words instead, quoting its own question when that part was sound.
function simulatedClarifyingAsk(payload: unknown): string {
  const question = (payload as { question?: unknown } | null)?.question;
  return typeof question === "string" && question.trim()
    ? `${question.trim()} Tell me in a sentence or two and I'll carry on from there.`
    : "I need a bit more context before I carry on. What would you like me to do next?";
}

// Delay before the simulated reply, so it reads as a response rather than an echo.
const REPLY_DELAY_MS = 700;

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
 * Above the compose box floats at most one card: a question the agent is blocked on
 * (ADR-039), or else, when the thread is active and the user has been away for 10+ minutes,
 * a recap of recorded outcomes (ADR-018). Anything that grows inside the thread is kept
 * clear of both (ADR-038).
 * @param width Panel width in px; omit to use the measure plus gutters.
 * @param activity Thread state that drives the recap; omit and no recap is shown.
 * A thread's awaiting question shows regardless: being blocked is not an idle state.
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
  // Card choices waiting to be sent, latest per card only (ADR-031).
  const [pending, setPending] = useState<Record<string, CardAttachment>>({});
  const [reported, setReported] = useState(() => initialReported(thread.messages));
  // Only a valid question becomes a card; a malformed one goes back to the agent (ADR-040).
  const [checked] = useState(() =>
    thread.awaiting === undefined ? undefined : resolveAwaiting(thread.awaiting),
  );
  const [awaiting, setAwaiting] = useState<AwaitingInput | undefined>(() =>
    checked?.kind === "approved" ? checked.question : undefined,
  );
  const scroller = useRef<HTMLDivElement>(null);
  const dockOverlay = useRef<HTMLDivElement>(null);

  const recapVisible =
    awaiting === undefined &&
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

  // The user never sees a malformed question or its error: the error goes to the agent, which
  // replies with an ordinary streamed ask. The lab has no agent, so a stand-in answers.
  useEffect(() => {
    if (checked?.kind !== "malformed") return;
    console.info(`[lab] sent to the agent: question rejected (${checked.reason})`);
    const id = window.setTimeout(
      () =>
        setMessages((current) => [
          ...current,
          {
            id: `clarify-${current.length}`,
            role: "agent",
            time: "now",
            text: simulatedClarifyingAsk(thread.awaiting),
            stream: true,
          },
        ]),
      REPLY_DELAY_MS,
    );
    return () => window.clearTimeout(id);
  }, [checked, thread.awaiting]);

  // Every card that grows inside the thread stays clear of the compose box (ADR-038).
  useEffect(() => {
    if (scroller.current) return keepExpansionsInView(scroller.current);
  }, []);

  // The dock card overlays the conversation, so reserve its height below the last turn,
  // keeping a reader who was at the bottom still at the bottom.
  const docked = awaiting !== undefined || recapVisible;
  useLayoutEffect(() => {
    const el = scroller.current;
    const slot = dockOverlay.current;
    if (!el) return;
    if (!slot) {
      el.style.removeProperty("--dock-space");
      return;
    }
    const reserve = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 4;
      // Layout offsets, not screen rects, so the card's slide-in animation can't skew them.
      const card = slot.firstElementChild instanceof HTMLElement ? slot.firstElementChild.offsetTop : 0;
      const composeInset = slot.nextElementSibling
        ? parseFloat(getComputedStyle(slot.nextElementSibling).paddingTop) || 0
        : 0;
      el.style.setProperty("--dock-space", `${slot.offsetHeight - card + composeInset}px`);
      if (atBottom) el.scrollTop = el.scrollHeight;
    };
    reserve();
    const observer = new ResizeObserver(reserve);
    observer.observe(slot);
    return () => observer.disconnect();
  }, [docked]);

  // A choice is only news if it differs from what the agent last saw on that card.
  function choose(attachment: CardAttachment) {
    setPending((current) => {
      const next = { ...current };
      if (reported[attachment.turnId] === attachment.state.measure) delete next[attachment.turnId];
      else next[attachment.turnId] = attachment;
      return next;
    });
  }

  function send() {
    const attachments = Object.values(pending);
    const sent: ThreadMessage = {
      id: `local-${messages.length}`,
      role: "user",
      text: draft.trim(),
      time: "now",
      attachments,
    };
    setMessages((current) => [...current, sent]);
    setDraft("");
    setPeeking(false);
    setLastInputAt(clock);
    setPending({});
    if (attachments.length === 0) return;
    setReported((current) => ({
      ...current,
      ...Object.fromEntries(attachments.map((item) => [item.turnId, item.state.measure])),
    }));
    window.setTimeout(
      () =>
        setMessages((current) => [
          ...current,
          {
            id: `reply-${current.length}`,
            role: "agent",
            time: "now",
            text: simulatedReply(attachments),
          },
        ]),
      REPLY_DELAY_MS,
    );
  }

  // An answer to the agent's question is the user's next turn; the agent then carries on.
  function answer(text: string) {
    setAwaiting(undefined);
    setLastInputAt(clock);
    setMessages((current) => [...current, { id: `local-${current.length}`, role: "user", text, time: "now" }]);
    window.setTimeout(
      () =>
        setMessages((current) => [
          ...current,
          { id: `reply-${current.length}`, role: "agent", time: "now", text: simulatedAnswerReply(text) },
        ]),
      REPLY_DELAY_MS,
    );
  }

  function focusCompose() {
    requestAnimationFrame(() =>
      scroller.current
        ?.closest(".thread-panel")
        ?.querySelector<HTMLTextAreaElement>(".compose-box textarea")
        ?.focus(),
    );
  }

  // Closing dictation returns focus to the text it fed, so the user can keep editing.
  function endDictation(transcript?: string) {
    if (transcript !== undefined) setDraft((current) => appendDictation(current, transcript));
    setDictating(false);
    focusCompose();
  }

  // Jump so the evidence lands vertically centered, every time (ADR-022 eye trace).
  function jump(turnId: string) {
    const turn = scroller.current?.querySelector<HTMLElement>(
      `[data-turn-id="${CSS.escape(turnId)}"]`,
    );
    if (!turn || !scroller.current) return;
    centerInScroller(scroller.current, turn);
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
            <AgentTurn key={message.id} message={message} onChoose={choose} />
          ),
        )}
      </div>
      <div className="thread-dock">
        {awaiting !== undefined && (
          <div className="dock-overlay" ref={dockOverlay}>
            <AwaitingInputCard
              question={awaiting}
              onAnswer={answer}
              onElsewhere={() => {
                setAwaiting(undefined);
                focusCompose();
              }}
            />
          </div>
        )}
        {recapVisible && (
          <div className="dock-overlay" ref={dockOverlay}>
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
            attachments={Object.values(pending).map((item) => ({
              id: item.turnId,
              label: item.label,
            }))}
            onRemoveAttachment={(id) =>
              setPending((current) => {
                const next = { ...current };
                delete next[id];
                return next;
              })
            }
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
