import type { Ref } from "react";
import { CatalogCard } from "./CatalogCard";
import { ChartGlyph } from "./ComposeBox";
import { InteractiveCard } from "./InteractiveCard";
import type { CardAttachment } from "./interactive";
import type { ThreadMessage } from "./thread";

type UserMessage = Extract<ThreadMessage, { role: "user" }>;
type AgentMessage = Extract<ThreadMessage, { role: "agent" }>;

/** The user's turn: a tinted bubble resting on the thread (ADR-025). */
export function UserTurn({ message, ref }: { message: UserMessage; ref?: Ref<HTMLElement> }) {
  return (
    <article
      ref={ref}
      className="turn turn-user"
      data-turn-id={message.id}
      aria-label={`You, ${message.time}`}
    >
      <p>{message.text}</p>
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
      <time>{message.time}</time>
    </article>
  );
}

/**
 * The agent's turn: prose first, then an optional catalog card sized by the panel. While a
 * reply is still streaming in, the turn is marked busy for assistive technology.
 * @param cardsCarry Whether a card's header carries it out onto the canvas (ADR-089).
 * @param shareable Whether a card offers its own share link; not on a page already shared
 * (ADR-064, ADR-129).
 */
export function AgentTurn({
  message,
  onChoose,
  cardsCarry,
  shareable = true,
  ref,
}: {
  message: AgentMessage;
  onChoose: (attachment: CardAttachment) => void;
  cardsCarry: boolean | undefined;
  shareable?: boolean;
  ref?: Ref<HTMLElement>;
}) {
  const carries = cardsCarry !== false;
  return (
    <article
      ref={ref}
      className="turn turn-agent"
      data-turn-id={message.id}
      aria-label={`Agent, ${message.time}`}
      aria-busy={message.streaming === true ? true : undefined}
    >
      <p>{message.text}</p>
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
    </article>
  );
}
