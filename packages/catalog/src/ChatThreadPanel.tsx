import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type Ref,
  type RefObject,
  type SetStateAction,
} from "react";
import type { Agent, AgentEvent } from "./agent";
import { AgentTree } from "./AgentTree";
import { AwaitingInputCard } from "./AwaitingInputCard";
import { resolveAwaiting, type AwaitingInput } from "./awaiting";
import { ComposeBox } from "./ComposeBox";
import { appendDictation } from "./dictation";
import { markGrabbableHighlight } from "./grabbable";
import { DictationModal, type DictationSource } from "./DictationModal";
import { IconButton } from "./IconButton";
import { StepIcon } from "./icons";
import { labAgent } from "./labAgent";
import { resolveInteractive, type CardAttachment } from "./interactive";
import { ReadingTools } from "./ReadingTools";
import { Recap } from "./Recap";
import { shouldShowRecap, type RecapItem } from "./recapRules";
import {
  applyChunk,
  cancelReply,
  completeReply,
  failReply,
  isEmptyReply,
  startReply,
  type AgentMessage,
  type ReplyChunk,
} from "./reply";
import type { Thread, ThreadHandle, ThreadMessage } from "./thread";
import {
  centerInScroller,
  keepExpansionsInView,
  releaseRunway,
  scrollToEnd,
  watchEndDistance,
} from "./threadReveal";
import { groupAnswers, latestEnded, requestBefore, runningActivity } from "./transcript";
import { AgentTurn, AnsweredTurns, UserTurn } from "./Turns";
import "./thread.css";

/**
 * A question the host asks in the thread's dock, in the agent's card (ADR-039) but answered to
 * the host: the card's name, the question, and what an answer or a dismissal does.
 */
export type HostAsk = {
  label: string;
  question: AwaitingInput;
  onAnswer: (answer: string) => void;
  onDismiss: () => void;
};

/** Whether the thread is still running, and when the user last sent something. */
export type ThreadActivity = { active: boolean; lastUserInputAt: number };

/**
 * How the thread takes dictation: which audio it hears, simulated unless told otherwise, and
 * whether it opens already recording (stories).
 */
export type Dictation = { source?: DictationSource; open?: boolean };

// The dictation setup with its defaults filled in.
function dictationSetup(dictation: Dictation | undefined): Required<Dictation> {
  return { source: "simulated", open: false, ...dictation };
}

// How often the idle clock re-checks when time is live rather than fixed.
const CLOCK_TICK_MS = 30_000;
// How long a jumped-to turn stays highlighted so the eye can find it.
const FLASH_MS = 1200;
// How far above its end a reader must be before the running status shows by the compose box:
// two lines of prose, so the last words still in view never raise it.
const STATUS_AWAY_PX = 48;

// A turn arriving brings its thread to the end, where the turn is: the thread opens at its
// latest turn and lands on each new one, and any room a jump left below the end goes. A reply
// growing as it streams stays in view through the thread's own pinning instead, so a reader who
// scrolled up is not pulled back.
function landOn(turn: HTMLElement | null) {
  const thread = turn?.parentElement; // → the scrolling thread, or undefined as a turn leaves
  if (!thread) return;
  releaseRunway(thread);
  thread.scrollTop = thread.scrollHeight;
}

// The dock card overlays the conversation, so its height is reserved below the last turn for
// as long as it is docked, keeping a reader who was at the bottom still at the bottom. The dock
// learns the same height, so what floats over it (the reading tools) stands above the card.
// Returns the release, which hands the space back.
function reserveDockSpace(thread: HTMLElement, slot: HTMLElement): () => void {
  const holders = [thread, slot.parentElement].filter((el) => el !== null); // → thread, dock
  const reserve = () => {
    const atBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 4;
    // Layout offsets, not screen rects, so the card's slide-in animation can't skew them.
    const card =
      slot.firstElementChild instanceof HTMLElement ? slot.firstElementChild.offsetTop : 0;
    const composeInset = slot.nextElementSibling
      ? parseFloat(getComputedStyle(slot.nextElementSibling).paddingTop) || 0
      : 0;
    const space = `${slot.offsetHeight - card + composeInset}px`;
    for (const holder of holders) holder.style.setProperty("--dock-space", space);
    if (atBottom) thread.scrollTop = thread.scrollHeight;
  };
  reserve();
  const observer = new ResizeObserver(reserve);
  observer.observe(slot);
  return () => {
    observer.disconnect();
    for (const holder of holders) holder.style.removeProperty("--dock-space");
  };
}

// The title in place, being renamed: Enter or leaving keeps what was typed through `commit`,
// Escape puts the old title back first.
function RenameField({
  title,
  field,
  commit,
}: {
  title: string;
  field: RefObject<HTMLInputElement | null>;
  commit: (typed: string) => void;
}) {
  return (
    <input
      className="thread-rename"
      aria-label="Thread title"
      defaultValue={title}
      ref={field}
      onBlur={(event) => {
        commit(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") event.currentTarget.value = title;
        if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
      }}
    />
  );
}

// The title bar. With `onRename` the title is a button that becomes a field on click: Enter or
// leaving the field keeps the new name, Escape or an empty name keeps the old one (ADR-089).
// Every way out goes through the field's blur, so the field is never torn down inside the key
// event that closed it. The host's `actions` sit at the bar's end (ADR-126).
function ThreadHeader({
  title,
  leading,
  onRename,
  actions,
}: {
  title: string;
  leading: ReactNode;
  onRename: ((title: string) => void) | undefined;
  actions: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) field.current?.select();
  }, [editing]);
  const commit = (typed: string) => {
    const next = typed.trim();
    if (next !== "" && next !== title) onRename?.(next);
    setEditing(false);
  };
  return (
    <header className="thread-header">
      {leading !== undefined && <div className="header-leading">{leading}</div>}
      {editing ? (
        <RenameField title={title} field={field} commit={commit} />
      ) : (
        <h2>
          {onRename ? (
            <button
              type="button"
              className="thread-title"
              title="Rename this thread"
              onClick={() => {
                setEditing(true);
              }}
            >
              {title}
            </button>
          ) : (
            title
          )}
        </h2>
      )}
      {actions !== undefined && <div className="thread-header-actions">{actions}</div>}
    </header>
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

/** What the panel can do with the replies it asked for. */
type Replies = {
  /**
   * Sends an event to the agent and streams its reply into a new turn. Returns the withdrawal:
   * the reply stops and its turn goes, as if it had never been asked for (an effect's cleanup).
   */
  tell: (event: AgentEvent) => () => void;
  /** Stops every reply still streaming; each turn is marked cancelled. */
  stop: () => void;
  /** Asks again for what the reply `turnId` answered, as a new turn below it. */
  retry: (turnId: string, messages: ThreadMessage[]) => void;
};

// `messages` with the agent turn `id` changed by `change`, or dropped when `change` leaves it
// holding nothing a reader could see.
function settleTurn(
  messages: ThreadMessage[],
  id: string,
  change: (turn: AgentMessage) => AgentMessage,
): ThreadMessage[] {
  return messages.flatMap((message) => {
    if (message.id !== id || message.role !== "agent") return [message];
    const turn = change(message);
    return isEmptyReply(turn) && turn.streaming !== true ? [] : [turn];
  });
}

// Where a reply's stream goes as it is read: each chunk into its turn, a question to the dock,
// and the end of a stream that ran its course.
type ReplySink = {
  fold: (chunk: ReplyChunk) => void;
  ask: (payload: unknown) => void;
  complete: () => void;
};

// Reads a reply's stream into `sink` until it ends, reports a failure (nothing it says after
// that belongs in the turn), or is stopped through `signal`. Throws what the stream throws.
async function readReply(
  stream: AsyncIterable<ReplyChunk>,
  signal: AbortSignal,
  sink: ReplySink,
): Promise<void> {
  for await (const chunk of stream) {
    if (signal.aborted) return;
    const event = typeof chunk === "string" ? undefined : chunk; // → ReplyEvent | undefined
    if (event?.kind === "question") sink.ask(event.question);
    sink.fold(chunk);
    if (event?.kind === "failure") return;
  }
  if (!signal.aborted) sink.complete();
}

/**
 * Sends events to the agent and folds each reply's stream into its own turn (ADR-041): words,
 * narration, steps, cards, a failure (reply.ts). The turn appears as the reply is asked for,
 * so it is its own placeholder while nothing has arrived, and it goes if the reply ends having
 * said nothing. A question in the stream goes to `onQuestion`, which the dock keeps current. Replies are kept
 * per id, since several can stream at once; each remembers what it answered, for a retry.
 * Replies stop when the panel unmounts.
 */
function useAgent(
  agent: Agent,
  setMessages: Dispatch<SetStateAction<ThreadMessage[]>>,
  onQuestion: RefObject<(payload: unknown) => void>,
): Replies {
  const replies = useRef(0);
  const live = useRef(new Map<string, AbortController>());
  const asked = useRef(new Map<string, AgentEvent>());

  useEffect(() => {
    const controllers = live.current;
    return () => {
      controllers.forEach((controller) => {
        controller.abort();
      });
    };
  }, []);

  // Pure updaters, since React may run them twice.
  const update = (id: string, change: (turn: AgentMessage) => AgentMessage) => {
    setMessages((current) => settleTurn(current, id, change));
  };

  const tell = (event: AgentEvent) => {
    const controller = new AbortController();
    const id = `reply-${++replies.current}`;
    live.current.set(id, controller);
    asked.current.set(id, event);
    setMessages((current) => [...current, startReply(id, "now")]);
    void (async () => {
      try {
        await readReply(agent.respond(event, controller.signal), controller.signal, {
          fold: (chunk) => {
            update(id, (turn) => applyChunk(turn, chunk));
          },
          ask: (payload) => {
            onQuestion.current(payload);
          },
          complete: () => {
            update(id, completeReply);
          },
        });
      } catch (error: unknown) {
        // A reply that breaks off (the gateway refused, the network dropped) ends the turn in
        // plain words rather than leaving it streaming forever; the cause stays in the console,
        // never in the thread (ADR-040).
        // oxlint-disable-next-line no-console -- the one place the thread reports a failed reply
        console.warn("[thread] reply failed:", error);
        if (!controller.signal.aborted) update(id, failReply);
      } finally {
        live.current.delete(id);
      }
    })();
    return () => {
      controller.abort();
      live.current.delete(id);
      setMessages((current) => current.filter((message) => message.id !== id));
    };
  };

  // Marks each turn cancelled here rather than when its stream notices the abort: a stream
  // waiting on a slow source may not wake for a while, and Stop has to show at once.
  const stop = () => {
    const stopped = new Set(live.current.keys());
    live.current.forEach((controller) => {
      controller.abort();
    });
    live.current.clear();
    setMessages((current) =>
      current.map((message) =>
        message.role === "agent" && stopped.has(message.id) ? cancelReply(message) : message,
      ),
    );
  };

  // A reply the panel asked for itself is asked again exactly; one the thread opened with is
  // read back from the user turn before it.
  const retry = (turnId: string, messages: ThreadMessage[]) => {
    const event = asked.current.get(turnId) ?? requestBefore(messages, turnId);
    if (event !== undefined) tell(event);
  };

  return { tell, stop, retry };
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
  onRetry,
  cardsCarry,
}: {
  message: ThreadMessage;
  onChoose: (attachment: CardAttachment) => void;
  onRetry: (turnId: string) => void;
  cardsCarry: boolean | undefined;
}) {
  return message.role === "user" ? (
    <UserTurn ref={landOn} message={message} />
  ) : (
    <AgentTurn
      ref={landOn}
      message={message}
      onChoose={onChoose}
      onRetry={onRetry}
      cardsCarry={cardsCarry}
    />
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
// again in an ordinary streamed reply, and the user never sees the error (ADR-040). The
// thread's own question is checked on the first render, so the report runs once per question;
// the Effect Event reads the latest `tell`, recreated each render, without making that a reason
// to ask again. A question that streams in with a reply (`ask`) takes the same two paths.
function useAwaiting(
  thread: Thread,
  tell: (event: AgentEvent) => () => void,
): {
  awaiting: AwaitingInput | undefined;
  setAwaiting: Dispatch<SetStateAction<AwaitingInput | undefined>>;
  ask: (payload: unknown) => void;
} {
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
  const ask = (payload: unknown) => {
    const result = resolveAwaiting(payload);
    if (result.kind === "approved") setAwaiting(result.question);
    else tell({ kind: "question-rejected", reason: result.reason, question: payload });
  };
  return { awaiting, setAwaiting, ask };
}

// What the scrolling thread does on its own: every card that grows inside it stays clear of
// the compose box (ADR-038), the docked card's space is reserved for as long as it is there,
// and a highlight shows the hand that says it can be picked up (ADR-089). The hook owns the
// ref to the thread it watches. The slot is held as state so the reservation follows the
// element: when it mounts, leaves, or one card replaces another.
function useScroller(): {
  scroller: RefObject<HTMLDivElement | null>;
  setDockSlot: (slot: HTMLDivElement | null) => void;
} {
  const scroller = useRef<HTMLDivElement>(null);
  const [dockSlot, setDockSlot] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scroller.current; // → the thread, mounted before any effect runs
    return el ? keepExpansionsInView(el) : undefined;
  }, [scroller]);
  useEffect(() => {
    const el = scroller.current;
    return el ? markGrabbableHighlight(el) : undefined;
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

// Each glowing turn's timer, so a later jump can clear the glow early.
const flashTimers = new WeakMap<HTMLElement, number>();

function clearFlash(turn: HTMLElement): void {
  window.clearTimeout(flashTimers.get(turn));
  flashTimers.delete(turn);
  delete turn.dataset.flash;
}

// Jump so the evidence lands vertically centered, every time (ADR-022 eye trace). Only the turn
// jumped to last glows: stepping through matches moves the glow rather than leaving a trail, and
// a second jump to the same turn starts its glow over.
function flashTurn(scroller: HTMLElement | null, turnId: string): void {
  const turn = scroller?.querySelector<HTMLElement>(`[data-turn-id="${CSS.escape(turnId)}"]`);
  if (!scroller || !turn) return;
  centerInScroller(scroller, turn);
  scroller.querySelectorAll<HTMLElement>("[data-flash]").forEach(clearFlash);
  void turn.offsetWidth; // a style flush, so the glow's animation starts over
  turn.dataset.flash = "true";
  flashTimers.set(
    turn,
    window.setTimeout(() => {
      clearFlash(turn);
    }, FLASH_MS),
  );
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

// The compose box's draft, with a read that is current between renders too, so a host can set
// the draft and send it in one go (ThreadHandle).
function useDraft(initial: string): {
  draft: string;
  setDraft: (value: string) => void;
  latest: () => string;
} {
  const [draft, setState] = useState(initial);
  const latest = useRef(initial);
  return {
    draft,
    setDraft: (value) => {
      latest.current = value;
      setState(value);
    },
    latest: () => latest.current,
  };
}

// Whether the reader is more than STATUS_AWAY_PX above the end of the turns, kept current as
// they scroll and as the turns grow.
function useAwayFromEnd(scroller: RefObject<HTMLElement | null>): boolean {
  const [away, setAway] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    return el
      ? watchEndDistance(el, (distance) => {
          setAway(distance > STATUS_AWAY_PX);
        })
      : undefined;
  }, [scroller]);
  return away;
}

// The running status by the compose box (ADR-142), for a reader who scrolled up while a reply
// streams: what the agent is doing, and a way back to it. It stands at the left of the reading
// tools' row, so the two share one line and can never overlap. The glyph's label announces the
// narration; the words beside it are for the eye.
function StatusStrip({ activity, onJump }: { activity: string; onJump: () => void }) {
  return (
    <div className="thread-status">
      <AgentTree label={activity} />
      <span className="thread-status-text" aria-hidden="true">
        {activity}
      </span>
      <IconButton label="Jump to latest" onClick={onJump}>
        <StepIcon down />
      </IconButton>
    </div>
  );
}

/**
 * A vertical chat thread column: header, scrolling turns, and a compose box that never moves.
 * Text is capped at `--thread-measure` (80ch) inside a `--thread-gutter` (20px) on each side,
 * and embedded catalog cards adapt to the panel's width through container queries.
 * Reading tools float at the right just above the compose box, or above the docked card: search,
 * and a jump to any request (ReadingTools).
 * Above the compose box floats at most one card: a question the agent is blocked on
 * (ADR-039), or else, when the thread is active and the user has been away for 10+ minutes,
 * a recap of recorded outcomes (ADR-018). Anything that grows inside the thread is kept
 * clear of both (ADR-038).
 * @param width Panel width in px; omit to use the measure plus gutters.
 * @param activity Thread state that drives the recap; omit and no recap is shown.
 * A thread's awaiting question shows regardless: being blocked is not an idle state.
 * @param now Fixed clock for deterministic stories and tests; omit for live time.
 * @param dictation Audio for dictation, simulated by default, and whether recording is
 * already open (stories).
 * @param agent Who answers: the scripted lab stand-in by default, or a real model (ADR-041).
 * @param initialDraft Text waiting in the compose box when the thread opens, such as a
 * highlight dropped on the canvas (ADR-089).
 * @param onRename When set, the title can be renamed in place; the host keeps the new name.
 * @param cardsCarry Let a card's header carry it out onto the compose canvas (ADR-089). On by
 * default; off where the host has no canvas to drop it on, such as a phone (ADR-122). The
 * catalog cannot see the host's layout, so the host decides.
 * @param headerActions What the host puts at the end of the title bar, such as the thread's
 * menu (ADR-126); the catalog cannot import the host's components, so it takes them whole.
 * @param hostAsk A question of the host's own in the dock, such as when to snooze (ADR-128). It
 * stands over the agent's question while it is open, since the user just asked for it.
 * @param leading A host's control before the title in the title bar, such as a lane's collapse
 * on the compose canvas (ADR-134).
 * @param bare Draw the thread on the surface it stands on, with no window frame and no title
 * bar of its own: a main thread's, whose tab carries its name, its rename and its menu (ADR-138),
 * so `onRename`, `leading` and `headerActions` have nowhere to show. Lanes on the canvas keep
 * the frame.
 * Replies stream in as structured turns (ADR-139, ADR-140). The user can keep talking while they
 * stream, stop them all from the compose box, and try one that stopped short again; a reader
 * scrolled up while a reply runs sees its status by the compose box (ADR-142).
 * @param ref What a host that drives the thread can do (ThreadHandle): fill and send the
 * compose box, answer the docked question, stop, or try again.
 * @param footnote A quiet line under the compose box, such as who controls the thread (ADR-141).
 */
// fallow scores each prop as cognitive load: the host's knobs alone tip it past 15, with no
// branch among them.
// fallow-ignore-next-line complexity
export function ChatThreadPanel({
  thread,
  width,
  activity,
  now,
  dictation,
  agent = labAgent,
  initialDraft = "",
  onRename,
  cardsCarry,
  headerActions,
  hostAsk,
  leading,
  empty,
  bare = false,
  footnote,
  ref,
}: {
  thread: Thread;
  width?: number;
  activity?: ThreadActivity;
  now?: number;
  dictation?: Dictation;
  agent?: Agent;
  initialDraft?: string;
  onRename?: (title: string) => void;
  cardsCarry?: boolean;
  headerActions?: ReactNode;
  hostAsk?: HostAsk;
  leading?: ReactNode;
  /** What the scroll area shows while the thread has no turns, such as a welcome. */
  empty?: ReactNode;
  bare?: boolean;
  footnote?: ReactNode;
  ref?: Ref<ThreadHandle>;
}) {
  const { source, open } = dictationSetup(dictation);
  const [messages, setMessages] = useState(thread.messages);
  // A question in a reply's stream goes to the dock, which needs the agent to report a malformed
  // one back: the dock's `ask` reaches the replies through this ref, kept current below.
  const questions = useRef<(payload: unknown) => void>(() => {});
  const replies = useAgent(agent, setMessages, questions);
  const { draft, setDraft, latest } = useDraft(initialDraft);
  const [dictating, setDictating] = useState(open);
  const outbox = useOutbox(thread.messages);
  const { awaiting, setAwaiting, ask } = useAwaiting(thread, replies.tell);
  useLayoutEffect(() => {
    questions.current = ask;
  });
  const recap = useRecap({ thread, activity, now, awaiting, draft });
  const { scroller, setDockSlot } = useScroller();
  const away = useAwayFromEnd(scroller);
  const running = runningActivity(messages); // → the latest streaming reply's narration
  const showEmpty = messages.length === 0 && empty !== undefined;

  function send() {
    const { attachments, files } = outbox.take();
    const text = latest().trim();
    setMessages((current) => [
      ...current,
      {
        id: `local-${current.length}`,
        role: "user",
        text,
        time: "now",
        attachments,
        files: files.map((item) => ({ id: item.id, label: item.file.name })),
      },
    ]);
    setDraft("");
    recap.fold();
    recap.noteInput();
    replies.tell({
      kind: "message",
      text,
      attachments,
      files: files.map(({ file }) => ({ name: file.name, type: file.type, size: file.size })),
    });
  }

  // An answer to the agent's question is the user's next turn, shown with the question it
  // answered; the agent then carries on.
  function answer(text: string) {
    const question = awaiting?.question;
    setAwaiting(undefined);
    recap.noteInput();
    setMessages((current) => [
      ...current,
      { id: `local-${current.length}`, role: "user", text, question, time: "now" },
    ]);
    replies.tell({ kind: "answer", text });
  }

  // The turn named, or the latest that stopped short.
  function retry(turnId?: string) {
    const target = turnId ?? latestEnded(messages);
    if (target !== undefined) replies.retry(target, messages);
  }

  // Editing the draft folds the recap back down once the text is gone.
  function editDraft(value: string) {
    setDraft(value);
    if (!value.trim()) recap.fold();
  }

  // Closing dictation returns focus to the text it fed, so the user can keep editing.
  function endDictation(transcript?: string) {
    if (transcript !== undefined) setDraft(appendDictation(latest(), transcript));
    setDictating(false);
    focusComposeIn(scroller.current);
  }

  useImperativeHandle(ref, () => ({
    setDraft: editDraft,
    send: () => {
      if (latest().trim() !== "" || outbox.attachments.length > 0) send();
    },
    answer: (text) => {
      if (awaiting !== undefined) answer(text);
    },
    stop: replies.stop,
    retry,
  }));

  return (
    <section
      className="thread-panel"
      style={{ width }}
      aria-label={thread.title}
      data-bare={bare ? "" : undefined}
      data-empty={showEmpty ? "" : undefined}
    >
      {!bare && (
        <ThreadHeader
          title={thread.title}
          leading={leading}
          onRename={onRename}
          actions={headerActions}
        />
      )}
      {/* The turns take a tab stop, so a keyboard can scroll a thread that holds nothing else
          to focus, such as one of plain words. The region carries the thread's name, so two
          threads side by side (lanes on the canvas) are two landmarks, not one twice. */}
      <div
        className="thread-scroll"
        ref={scroller}
        data-empty={showEmpty ? "" : undefined}
        {...(messages.length > 0 && {
          role: "region",
          "aria-label": `Messages in ${thread.title}`,
          tabIndex: 0,
        })}
      >
        {messages.length === 0 && empty}
        {groupAnswers(messages).map((item) =>
          item.kind === "answers" ? (
            <AnsweredTurns key={item.id} ref={landOn} messages={item.messages} />
          ) : (
            <Turn
              key={item.message.id}
              message={item.message}
              onChoose={outbox.choose}
              onRetry={retry}
              cardsCarry={cardsCarry}
            />
          ),
        )}
      </div>
      <div className="thread-dock">
        {messages.length > 0 && (
          <div className="reading-dock">
            {running !== undefined && away && (
              <StatusStrip
                activity={running}
                onJump={() => {
                  if (scroller.current) scrollToEnd(scroller.current);
                }}
              />
            )}
            <ReadingTools
              messages={messages}
              onJump={(turnId) => {
                flashTurn(scroller.current, turnId);
              }}
            />
          </div>
        )}
        {hostAsk !== undefined && (
          <div className="dock-overlay" ref={setDockSlot}>
            <AwaitingInputCard
              label={hostAsk.label}
              question={hostAsk.question}
              onAnswer={hostAsk.onAnswer}
              onElsewhere={() => {
                hostAsk.onDismiss();
                focusComposeIn(scroller.current);
              }}
            />
          </div>
        )}
        {hostAsk === undefined && awaiting !== undefined && (
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
        {hostAsk === undefined && recap.visible && (
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
        <div className="thread-compose" data-footnote={footnote === undefined ? undefined : ""}>
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
            busy={running !== undefined}
            onStop={replies.stop}
          />
        </div>
        {footnote !== undefined && <div className="thread-footnote">{footnote}</div>}
      </div>
      {dictating && (
        <DictationModal
          source={source}
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
