import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { CatalogCard } from "./CatalogCard";
import type { Thread, ThreadMessage } from "./thread";
import "./thread.css";

type UserMessage = Extract<ThreadMessage, { role: "user" }>;
type AgentMessage = Extract<ThreadMessage, { role: "agent" }>;

// The user's turn is a high-contrast landmark so it can be found when scrolling back (ADR-021).
function UserTurn({ message }: { message: UserMessage }) {
  return (
    <article className="turn turn-user" aria-label={`You, ${message.time}`}>
      <p>{message.text}</p>
      <time>{message.time}</time>
    </article>
  );
}

// The agent's turn is prose first, then an optional catalog card sized by the panel.
function AgentTurn({ message }: { message: AgentMessage }) {
  return (
    <article className="turn turn-agent" aria-label={`Agent, ${message.time}`}>
      <p>{message.text}</p>
      {message.payload !== undefined && (
        <CatalogCard payload={message.payload} context="thread" />
      )}
    </article>
  );
}

/**
 * A vertical chat thread column: header, scrolling turns, and a compose box that never moves.
 * Text is capped at `--thread-measure` (80ch) inside a `--thread-gutter` (20px) on each side,
 * and embedded catalog cards adapt to the panel's width through container queries.
 * @param width Panel width in px; omit to use the measure plus gutters.
 */
export function ChatThreadPanel({
  thread,
  width,
}: {
  thread: Thread;
  width?: number;
}) {
  const [messages, setMessages] = useState(thread.messages);
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  // Open at the latest turn, the way a returning user expects to land.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages([
      ...messages,
      { id: `local-${messages.length}`, role: "user", text, time: "now" },
    ]);
    setDraft("");
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
      <form className="thread-compose" onSubmit={send}>
        <div className="compose-box">
          <textarea
            aria-label="Message"
            placeholder="What would you like to do?"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) send(event);
            }}
          />
          <div className="compose-bar">
            <span className="muted">Enter to send · Shift+Enter for a new line</span>
            <button type="submit" disabled={!draft.trim()} aria-label="Send">
              ↑
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
