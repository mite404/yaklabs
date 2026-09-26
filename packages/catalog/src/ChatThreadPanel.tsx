import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type Ref,
  type RefObject,
  type SetStateAction,
} from "react";
import type { Agent, AgentEvent } from "./agent";
import { AwaitingInputCard } from "./AwaitingInputCard";
import { resolveAwaiting, type AwaitingInput } from "./awaiting";
import { CatalogCard } from "./CatalogCard";
import { ChartGlyph, ComposeBox } from "./ComposeBox";
import { appendDictation } from "./dictation";
import { DictationModal, type DictationSource } from "./DictationModal";
import { InteractiveCard } from "./InteractiveCard";
import { labAgent } from "./labAgent";
import { resolveInteractive, type CardAttachment } from "./interactive";
import { Recap } from "./Recap";
import { shouldShowRecap, type RecapItem } from "./recapRules";
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

// A turn arriving brings its thread to the end, where the turn is: the thread opens at its
// latest turn and lands on each new one. A reply growing as it streams stays in view through
// the thread's own pinning instead, so a reader who scrolled up is not pulled back.
function landOn(turn: HTMLElement | null) {
  const thread = turn?.parentElement; // → the scrolling thread, or undefined as a turn leaves
  if (thread) thread.scrollTop = thread.scrollHeight;
}

// The dock card overlays the conversation, so its height is reserved below the last turn for
// as long as it is docked, keeping a reader who was at the bottom still at the bottom.
// Returns the release, which hands the space back.
function reserveDockSpace(thread: HTMLElement, slot: HTMLElement): () => void {
  const reserve = () => {
    const atBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 4;
    // Layout offsets, not screen rects, so the card's slide-in animation can't skew them.
    const card =
      slot.firstElementChild instanceof HTMLElement ? slot.firstElementChild.offsetTop : 0;
    const composeInset = slot.nextElementSibling
      ? parseFloat(getComputedStyle(slot.nextElementSibling).paddingTop) || 0
      : 0;
    thread.style.setProperty("--dock-space", `${slot.offsetHeight - card + composeInset}px`);
    if (atBottom) thread.scrollTop = thread.scrollHeight;
  };
  reserve();
  const observer = new ResizeObserver(reserve);
  observer.observe(slot);
  return () => {
    observer.disconnect();
    thread.style.removeProperty("--dock-space");
  };
}

// The user's turn: a tinted bubble resting on the thread (ADR-025).
function UserTurn({ message, ref }: { message: UserMessage; ref: Ref<HTMLElement> }) {
  return (
    <article
      ref={ref}
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
      {message.files && message.files.length > 0 && (
        <ul className="sent-context" aria-label="Files sent with this message">
          {message.files.map((item) => (
            <li key={item.id} className="context-chip">
              {item.label}
            </li>
          ))}
        </ul>
      )}
      <time>{message.time}</time>
    </article>
  );
}

// The agent's turn: prose first, then an optional catalog card sized by the panel.
// While a reply is still streaming in, the turn is marked busy for assistive technology.
function AgentTurn({
  message,
  onChoose,
  ref,
}: {
  message: AgentMessage;
  onChoose: (attachment: CardAttachment) => void;
  ref: Ref<HTMLElement>;
}) {
  return (
    <article
      ref={ref}
      className="turn turn-agent"
      data-turn-id={message.id}
      aria-label={`Agent, ${message.time}`}
      aria-busy={message.streaming || undefined}
    >
      <p>{message.text}</p>
      {message.payload !== undefined && (
        <CatalogCard payload={message.payload} context="thread" draggable />
      )}
      {message.interactive !== undefined && (
        <InteractiveCard
          payload={message.interactive}
          turnId={message.id}
          onChoose={onChoose}
          draggable
        />
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

// What the thread says when a reply never arrives, so the user is not left waiting on a bubble.
const REPLY_FAILED = "I couldn't finish that reply. Try again in a moment.";

/**
 * Sends events to the agent and streams each reply into the thread as its own turn (ADR-041).
 * Replies stop when the panel unmounts. Returns the function that sends an event.
 */
function useAgent(
  agent: Agent,
  setMessages: Dispatch<SetStateAction<ThreadMessage[]>>,
): (event: AgentEvent) => () => void {
  const replies = useRef(0);
  const live = useRef(new Set<AbortController>());

  useEffect(() => {
    const controllers = live.current;
    return () => {
      controllers.forEach((controller) => {
        controller.abort();
      });
    };
  }, []);

  return (event) => {
    const controller = new AbortController();
    const id = `reply-${++replies.current}`;
    live.current.add(controller);
    // Pure updaters (React may run them twice): append on the first chunk, then extend.
    const write = (text: string, streaming: boolean) => {
      setMessages((current) =>
        current.some((message) => message.id === id)
          ? current.map((message) =>
              message.id === id && message.role === "agent"
                ? { ...message, text: message.text + text, streaming }
                : message,
            )
          : [...current, { id, role: "agent", time: "now", text, streaming }],
      );
    };
    void (async () => {
      let started = false;
      try {
        for await (const chunk of agent.respond(event, controller.signal)) {
          if (controller.signal.aborted) break;
          write(chunk, true);
          started = true;
        }
        if (started && !controller.signal.aborted) write("", false);
      } catch (error: unknown) {
        // A reply that breaks off (the gateway refused, the network dropped) ends the turn in
        // plain words rather than leaving a bubble streaming forever; the cause stays in the
        // console, never in the thread (ADR-040).
        // oxlint-disable-next-line no-console -- the one place the thread reports a failed reply
        console.warn("[thread] reply failed:", error);
        if (!controller.signal.aborted) write(started ? "" : REPLY_FAILED, false);
      } finally {
        live.current.delete(controller);
      }
    })();
    return () => {
      controller.abort();
    };
  };
}

// A live clock, or a fixed one when the host passes `now` (stories and tests).
function useClock(now?: number): number {
  const [live, setLive] = useState(() => Date.now());
  useEffect(() => {
    // A fixed clock never ticks; clearing an interval that was never set is a no-op.
    const id =
      now === undefined
        ? window.setInterval(() => {
            setLive(Date.now());
          }, CLOCK_TICK_MS)
        : undefined;
    return () => {
      window.clearInterval(id);
    };
  }, [now]);
  return now ?? live;
}

// One turn of either role; each new one brings the thread to its end (see `landOn`).
function Turn({
  message,
  onChoose,
}: {
  message: ThreadMessage;
  onChoose: (attachment: CardAttachment) => void;
}) {
  return message.role === "user" ? (
    <UserTurn ref={landOn} message={message} />
  ) : (
    <AgentTurn ref={landOn} message={message} onChoose={onChoose} />
  );
}

// What rides along with the next message: card choices, latest per card (ADR-031), and files
// or screenshots (ADR-063). `reported` is what the agent last saw on each card, so a choice
// is only news when it differs from it.
type Outbox = {
  pending: CardAttachment[];
  files: { id: string; file: File }[];
  /** The compose box's chips, cards first. */
  attachments: { id: string; label: string; kind: "card" | "file" }[];
  choose: (attachment: CardAttachment) => void;
  remove: (id: string) => void;
  attach: (picked: File[]) => void;
  /** Empties the outbox for a send and remembers what the agent now knows of each card. */
  take: () => { attachments: CardAttachment[]; files: { id: string; file: File }[] };
};

function useOutbox(initial: ThreadMessage[]): Outbox {
  const [pending, setPending] = useState<Record<string, CardAttachment>>({});
  const [reported, setReported] = useState(() => initialReported(initial));
  const [files, setFiles] = useState<{ id: string; file: File }[]>([]);
  const fileIds = useRef(0);

  const choose = (attachment: CardAttachment) => {
    setPending((current) => {
      const next = { ...current };
      if (reported[attachment.turnId] === attachment.state.measure) delete next[attachment.turnId];
      else next[attachment.turnId] = attachment;
      return next;
    });
  };
  const remove = (id: string) => {
    setFiles((current) => current.filter((item) => item.id !== id));
    setPending((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };
  const attach = (picked: File[]) => {
    setFiles((current) => [
      ...current,
      ...picked.map((file) => ({ id: `file-${++fileIds.current}`, file })),
    ]);
  };
  const take = () => {
    const attachments = Object.values(pending); // → CardAttachment[]
    setPending({});
    setFiles([]);
    setReported((current) => ({
      ...current,
      ...Object.fromEntries(attachments.map((item) => [item.turnId, item.state.measure])),
    }));
    return { attachments, files };
  };

  return {
    pending: Object.values(pending),
    files,
    attachments: [
      ...Object.values(pending).map((item) => ({
        id: item.turnId,
        label: item.label,
        kind: "card" as const,
      })),
      ...files.map((item) => ({ id: item.id, label: item.file.name, kind: "file" as const })),
    ],
    choose,
    remove,
    attach,
    take,
  };
}

// Only a valid question becomes a card; a malformed one goes back to the agent, which asks
// again in an ordinary streamed reply, and the user never sees the error (ADR-040). `checked`
// is settled on the first render, so the report runs once per question; the Effect Event
// reads the latest `tell`, recreated each render, without making that a reason to ask again.
function useAwaiting(
  thread: Thread,
  tell: (event: AgentEvent) => () => void,
): [AwaitingInput | undefined, Dispatch<SetStateAction<AwaitingInput | undefined>>] {
  const [checked] = useState(() =>
    thread.awaiting === undefined ? undefined : resolveAwaiting(thread.awaiting),
  );
  const [awaiting, setAwaiting] = useState<AwaitingInput | undefined>(() =>
    checked?.kind === "approved" ? checked.question : undefined,
  );
  const reportMalformed = useEffectEvent((reason: string) =>
    tell({ kind: "question-rejected", reason, question: thread.awaiting }),
  );
  useEffect(
    () => (checked?.kind === "malformed" ? reportMalformed(checked.reason) : undefined),
    [checked],
  );
  return [awaiting, setAwaiting];
}

// Every card that grows inside the thread stays clear of the compose box (ADR-038), and the
// docked card's space is reserved for as long as it is there. The hook owns the ref to the
// scrolling thread it watches. The slot is held as state so the reservation follows the
// element: when it mounts, leaves, or one card replaces another.
function useDockLayout(): {
  scroller: RefObject<HTMLDivElement | null>;
  setDockSlot: (slot: HTMLDivElement | null) => void;
} {
  const scroller = useRef<HTMLDivElement>(null);
  const [dockSlot, setDockSlot] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scroller.current; // → the thread, mounted before any effect runs
    return el ? keepExpansionsInView(el) : undefined;
  }, [scroller]);
  useLayoutEffect(() => {
    const el = scroller.current;
    return el && dockSlot ? reserveDockSpace(el, dockSlot) : undefined;
  }, [scroller, dockSlot]);
  return { scroller, setDockSlot };
}

// The recap floats only while nothing else needs the dock and the user has been away (ADR-018).
function recapIsVisible(input: {
  awaiting: AwaitingInput | undefined;
  activity: ThreadActivity | undefined;
  lastInputAt: number | undefined;
  recapCount: number;
  clock: number;
  dismissedAt: number | undefined;
}): boolean {
  const { awaiting, activity, lastInputAt, recapCount, clock, dismissedAt } = input;
  return (
    awaiting === undefined &&
    activity !== undefined &&
    lastInputAt !== undefined &&
    recapCount > 0 &&
    shouldShowRecap({
      now: clock,
      lastUserInputAt: lastInputAt,
      active: activity.active,
      dismissedAt,
    })
  );
}

// What the recap keeps for itself (ADR-018): the clock, when the user last spoke, whether they
// dismissed it, and whether they peeked at it while a draft was open. `fold` puts it back behind
// the draft; `noteInput` marks the user's turn, which restarts the idle clock.
type RecapState = {
  visible: boolean;
  collapsed: boolean;
  items: RecapItem[];
  idleMs: number;
  expand: () => void;
  fold: () => void;
  dismiss: () => void;
  noteInput: () => void;
};

function useRecap(input: {
  thread: Thread;
  activity: ThreadActivity | undefined;
  now: number | undefined;
  awaiting: AwaitingInput | undefined;
  draft: string;
}): RecapState {
  const { thread, activity, now, awaiting, draft } = input;
  const clock = useClock(now);
  const [lastInputAt, setLastInputAt] = useState(activity?.lastUserInputAt);
  const [dismissedAt, setDismissedAt] = useState<number>();
  const [peeking, setPeeking] = useState(false);
  const items = thread.recap ?? []; // → RecapItem[]
  return {
    visible: recapIsVisible({
      awaiting,
      activity,
      lastInputAt,
      recapCount: items.length,
      clock,
      dismissedAt,
    }),
    collapsed: draft.trim() !== "" && !peeking,
    items,
    idleMs: clock - (lastInputAt ?? clock),
    expand: () => {
      setPeeking(true);
    },
    fold: () => {
      setPeeking(false);
    },
    dismiss: () => {
      setDismissedAt(clock);
    },
    noteInput: () => {
      setLastInputAt(clock);
    },
  };
}

// Jump so the evidence lands vertically centered, every time (ADR-022 eye trace).
function flashTurn(scroller: HTMLElement | null, turnId: string): void {
  const turn = scroller?.querySelector<HTMLElement>(`[data-turn-id="${CSS.escape(turnId)}"]`);
  if (!scroller || !turn) return;
  centerInScroller(scroller, turn);
  turn.dataset.flash = "true";
  window.setTimeout(() => {
    delete turn.dataset.flash;
  }, FLASH_MS);
}

// After a card or a modal hands back control, the caret returns to the compose box.
function focusComposeIn(scroller: HTMLElement | null): void {
  requestAnimationFrame(() =>
    scroller
      ?.closest(".thread-panel")
      ?.querySelector<HTMLTextAreaElement>(".compose-box textarea")
      ?.focus(),
  );
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
 * @param agent Who answers: the scripted lab stand-in by default, or a real model (ADR-041).
 * @param initialDraft Text waiting in the compose box when the thread opens, such as a
 * highlight dropped on the canvas (ADR-089).
 */
export function ChatThreadPanel({
  thread,
  width,
  activity,
  now,
  dictationSource = "simulated",
  startDictating = false,
  agent = labAgent,
  initialDraft = "",
}: {
  thread: Thread;
  width?: number;
  activity?: ThreadActivity;
  now?: number;
  dictationSource?: DictationSource;
  startDictating?: boolean;
  agent?: Agent;
  initialDraft?: string;
}) {
  const [messages, setMessages] = useState(thread.messages);
  const tell = useAgent(agent, setMessages);
  const [draft, setDraft] = useState(initialDraft);
  const [dictating, setDictating] = useState(startDictating);
  const outbox = useOutbox(thread.messages);
  const [awaiting, setAwaiting] = useAwaiting(thread, tell);
  const recap = useRecap({ thread, activity, now, awaiting, draft });
  const { scroller, setDockSlot } = useDockLayout();

  function send() {
    const { attachments, files } = outbox.take();
    const sent: ThreadMessage = {
      id: `local-${messages.length}`,
      role: "user",
      text: draft.trim(),
      time: "now",
      attachments,
      files: files.map((item) => ({ id: item.id, label: item.file.name })),
    };
    setMessages((current) => [...current, sent]);
    setDraft("");
    recap.fold();
    recap.noteInput();
    tell({
      kind: "message",
      text: sent.text,
      attachments,
      files: files.map(({ file }) => ({ name: file.name, type: file.type, size: file.size })),
    });
  }

  // An answer to the agent's question is the user's next turn; the agent then carries on.
  function answer(text: string) {
    setAwaiting(undefined);
    recap.noteInput();
    setMessages((current) => [
      ...current,
      { id: `local-${current.length}`, role: "user", text, time: "now" },
    ]);
    tell({ kind: "answer", text });
  }

  // Editing the draft folds the recap back down once the text is gone.
  function editDraft(value: string) {
    setDraft(value);
    if (!value.trim()) recap.fold();
  }

  // Closing dictation returns focus to the text it fed, so the user can keep editing.
  function endDictation(transcript?: string) {
    if (transcript !== undefined) setDraft((current) => appendDictation(current, transcript));
    setDictating(false);
    focusComposeIn(scroller.current);
  }

  return (
    <section className="thread-panel" style={{ width }} aria-label={thread.title}>
      <header className="thread-header">
        <h2>{thread.title}</h2>
      </header>
      <div className="thread-scroll" ref={scroller}>
        {messages.map((message) => (
          <Turn key={message.id} message={message} onChoose={outbox.choose} />
        ))}
      </div>
      <div className="thread-dock">
        {awaiting !== undefined && (
          <div className="dock-overlay" ref={setDockSlot}>
            <AwaitingInputCard
              question={awaiting}
              onAnswer={answer}
              onElsewhere={() => {
                setAwaiting(undefined);
                focusComposeIn(scroller.current);
              }}
            />
          </div>
        )}
        {recap.visible && (
          <div className="dock-overlay" ref={setDockSlot}>
            <Recap
              items={recap.items}
              idleMs={recap.idleMs}
              collapsed={recap.collapsed}
              onExpand={recap.expand}
              onDismiss={recap.dismiss}
              onJump={(turnId) => {
                flashTurn(scroller.current, turnId);
              }}
            />
          </div>
        )}
        <div className="thread-compose">
          <ComposeBox
            draft={draft}
            onDraftChange={editDraft}
            onSend={send}
            onDictate={() => {
              setDictating(true);
            }}
            disabled={dictating}
            attachments={outbox.attachments}
            onRemoveAttachment={outbox.remove}
            onAttachFiles={outbox.attach}
          />
        </div>
      </div>
      {dictating && (
        <DictationModal
          source={dictationSource}
          onCancel={() => {
            endDictation();
          }}
          onDone={(transcript) => {
            endDictation(transcript);
          }}
        />
      )}
    </section>
  );
}
