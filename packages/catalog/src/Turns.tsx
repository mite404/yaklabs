import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
  type RefObject,
} from "react";
import { AgentTree } from "./AgentTree";
import { CatalogCard } from "./CatalogCard";
import { ChartGlyph } from "./ComposeBox";
import { InteractiveCard } from "./InteractiveCard";
import type { CardAttachment } from "./interactive";
import { Prose } from "./QuietProse";
import { blocksOf, type Ended } from "./reply";
import type { ThreadMessage } from "./thread";
import type { AnsweredMessage } from "./transcript";
import { WorkDetails } from "./WorkDetails";

type UserMessage = Extract<ThreadMessage, { role: "user" }>;
type AgentMessage = Extract<ThreadMessage, { role: "agent" }>;

// A bubble's text clamps past eight of its 24px lines, so a long paste never buries the reply.
const BUBBLE_CLAMP_PX = 8 * 24;
// The clamp as the bubble's style hands it to thread.css, so the height has one source.
const CLAMP_STYLE: CSSProperties & Record<`--${string}`, string> = {
  "--bubble-clamp": `${BUBBLE_CLAMP_PX}px`,
};

// How a reply that stopped short says so, first on its note (ADR-139).
const ENDED_LABELS: Record<Ended, string> = {
  interrupted: "Interrupted · Incomplete answer",
  failed: "Could not start",
  cancelled: "Stopped by you",
};

// Whether a stopped reply offers to try again: not one the user stopped, who can simply ask.
const RETRYABLE: Record<Ended, boolean> = { interrupted: true, failed: true, cancelled: false };

// Calls `onChange` with whether `el`'s content runs taller than `maxPx`, now and as it resizes
// (a narrower panel wraps more lines). Returns the function that stops watching.
function watchOverflow(el: HTMLElement, maxPx: number, onChange: (over: boolean) => void) {
  const observer = new ResizeObserver(() => {
    onChange(el.scrollHeight > maxPx + 1); // a rounding pixel is not a hidden line
  });
  observer.observe(el);
  return () => {
    observer.disconnect();
  };
}

// Whether `element`'s content runs taller than `maxPx`. Measured before paint, so a long bubble
// never flashes unclamped.
function useClamped(element: RefObject<HTMLElement | null>, maxPx: number): boolean {
  const [clamped, setClamped] = useState(false);
  useLayoutEffect(() => {
    const el = element.current;
    return el ? watchOverflow(el, maxPx, setClamped) : undefined;
  }, [element, maxPx]);
  return clamped;
}

// The bubble's text, clamped with a fade and a Show more when it runs past eight lines.
function BubbleText({ text }: { text: string }) {
  const body = useRef<HTMLParagraphElement>(null);
  const clamped = useClamped(body, BUBBLE_CLAMP_PX);
  const [open, setOpen] = useState(false);
  return (
    <div className="user-bubble">
      <p ref={body} data-clamped={clamped && !open ? "" : undefined} style={CLAMP_STYLE}>
        {text}
      </p>
      {clamped && (
        <button
          type="button"
          className="bubble-more"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

/**
 * The user's turn: a tinted bubble resting on the thread (ADR-025), with no time of its own: the
 * latest reply's stamp dates the exchange. Past eight lines the text folds behind a fade and a
 * Show more, so a long paste never pushes the reply out of view.
 */
export function UserTurn({ message, ref }: { message: UserMessage; ref?: Ref<HTMLElement> }) {
  return (
    <article ref={ref} className="turn turn-user" data-turn-id={message.id} aria-label="You">
      <BubbleText text={message.text} />
      {message.attachments !== undefined && message.attachments.length > 0 && (
        <ul className="sent-context" aria-label="Sent with this message">
          {message.attachments.map((item) => (
            <li key={item.turnId} className="context-chip">
              <ChartGlyph />
              {item.label}
            </li>
          ))}
        </ul>
      )}
      {message.files !== undefined && message.files.length > 0 && (
        <ul className="sent-context" aria-label="Files sent with this message">
          {message.files.map((item) => (
            <li key={item.id} className="context-chip">
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/**
 * The user's answers to the agent's docked questions (ADR-039), on one quiet surface: each
 * question over the answer it got, consecutive answers together. Each pair keeps its turn's id,
 * so a search or a jump lands on the answer itself.
 */
export function AnsweredTurns({
  messages,
  ref,
}: {
  messages: AnsweredMessage[];
  ref?: Ref<HTMLElement>;
}) {
  return (
    <article ref={ref} className="turn turn-answered" aria-label="Your answers">
      <dl>
        {messages.map((message) => (
          <div key={message.id} className="answered-pair" data-turn-id={message.id}>
            <dt>{message.question}</dt>
            <dd>{message.text}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

// A reply with nothing to show yet: the same working glyph the sidebar shows and a plain,
// factual line, the agent's own narration when it gave one, never a guessed tool name (ADR-041).
// The glyph's label carries the announcement, so the visible line stays out of a screen
// reader's way.
function Waiting({ activity }: { activity: string | undefined }) {
  return (
    <div className="turn-pending">
      <AgentTree label={activity ?? "Thinking"} />
      <span aria-hidden="true">{activity ?? "Thinking…"}</span>
    </div>
  );
}

// What a streaming reply is doing now, quietly under its words (ADR-139).
function Activity({ activity }: { activity: string }) {
  return (
    <div className="turn-activity">
      <AgentTree label={activity} />
      <span aria-hidden="true">{activity}</span>
    </div>
  );
}

// The reply's words, or its placeholder while it has none, and what it is doing now.
function Words({
  message,
  cardsCarry,
  shareable,
}: {
  message: AgentMessage;
  cardsCarry: boolean | undefined;
  shareable: boolean;
}) {
  const blocks = blocksOf(message); // → Block[]
  const { streaming, activity } = message;
  if (blocks.length === 0) return streaming === true && <Waiting activity={activity} />;
  return (
    <>
      <Prose blocks={blocks} cardsCarry={cardsCarry} shareable={shareable} />
      {streaming === true && activity !== undefined && <Activity activity={activity} />}
    </>
  );
}

// How a reply that stopped short ended, why, and a way to ask again (ADR-139).
function EndedNote({
  message,
  ended,
  onRetry,
}: {
  message: AgentMessage;
  ended: Ended;
  onRetry: ((turnId: string) => void) | undefined;
}) {
  return (
    <div className="turn-ended" data-ended={ended}>
      <p className="turn-ended-label">{ENDED_LABELS[ended]}</p>
      {message.failure !== undefined && <p>{message.failure.detail}</p>}
      {RETRYABLE[ended] && onRetry !== undefined && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            onRetry(message.id);
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * The agent's turn: Quiet prose with any cards between its paragraphs (ADR-140), what the agent
 * is doing while it streams, how it ended when it stopped short, and the work behind it folded
 * under Work details (ADR-139). A reply with no words yet is its own placeholder. While a reply
 * is still streaming in, the turn is marked busy for assistive technology.
 * @param cardsCarry Whether a card's header carries it out onto the canvas (ADR-089).
 * @param shareable Whether a card offers its own share link; not on a page already shared
 * (ADR-064, ADR-131).
 * @param onRetry Asks for a reply that stopped short again; without it there is no Try again.
 * @param stamp How long ago this reply arrived, on the thread's latest reply alone: "just now",
 * then in 20-minute steps (turnTime.ts). Absent on every other turn.
 */
export function AgentTurn({
  message,
  onChoose,
  cardsCarry,
  shareable = true,
  onRetry,
  stamp,
  ref,
}: {
  message: AgentMessage;
  onChoose: (attachment: CardAttachment) => void;
  cardsCarry: boolean | undefined;
  shareable?: boolean;
  onRetry?: (turnId: string) => void;
  stamp?: string;
  ref?: Ref<HTMLElement>;
}) {
  const carries = cardsCarry !== false;
  const { work, ended } = message;
  const worked = work !== undefined && (work.steps.length > 0 || work.logs.length > 0);
  return (
    <article
      ref={ref}
      className="turn turn-agent"
      data-turn-id={message.id}
      aria-label="Agent"
      aria-busy={message.streaming === true ? true : undefined}
    >
      <Words message={message} cardsCarry={cardsCarry} shareable={shareable} />
      {message.payload !== undefined && (
        <CatalogCard
          payload={message.payload}
          context="thread"
          draggable={carries}
          shareable={shareable}
        />
      )}
      {message.interactive !== undefined && (
        <InteractiveCard
          payload={message.interactive}
          turnId={message.id}
          onChoose={onChoose}
          draggable={carries}
          shareable={shareable}
        />
      )}
      {ended !== undefined && <EndedNote message={message} ended={ended} onRetry={onRetry} />}
      {worked && <WorkDetails work={work} cardsCarry={cardsCarry} />}
      {stamp !== undefined && <time className="turn-stamp">{stamp}</time>}
    </article>
  );
}
