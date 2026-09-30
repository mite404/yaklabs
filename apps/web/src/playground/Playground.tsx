import { ComposeBox, UserTurn } from "@yaklabs/catalog";
import type { PlaygroundRequest, UserInput } from "@yaklabs/catalog/playground";
import { useEffect, useReducer, useRef, useState } from "react";
import { env } from "../env";
import { useSession } from "../session";
import { AgentReply } from "./Reply";
import { toPlaygroundRequest } from "./request";
import {
  initialPlayground,
  isLocked,
  reducePlayground,
  type Exchange,
  type PlaygroundAction,
} from "./state";
import { pumpPlayground } from "./stream";
import "./playground.css";

// How close to the end, in px, still counts as reading the latest turn.
const PINNED_WITHIN = 48;

function clockTime(): string {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// New turns land at the end while the reader is there; a reader who scrolled up stays put.
function useStickToBottom() {
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useEffect(() => {
    const element = scroller.current;
    if (element !== null && pinned.current) element.scrollTop = element.scrollHeight;
  });
  function onScroll() {
    const element = scroller.current;
    if (element === null) return;
    const below = element.scrollHeight - element.scrollTop - element.clientHeight;
    pinned.current = below < PINNED_WITHIN;
  }
  function pin() {
    pinned.current = true;
  }
  return { scroller, onScroll, pin };
}

// The page's state and the two ways to start a reply. Each starts only if the reducer
// accepts its action (a refusal returns the same state), the single rule for what may be
// sent; leaving the page aborts the stream in flight.
function usePlaygroundReplies(onStart: () => void) {
  const session = useSession();
  const [state, dispatch] = useReducer(reducePlayground, initialPlayground);
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  function start(action: PlaygroundAction, request: PlaygroundRequest): boolean {
    if (reducePlayground(state, action) === state) return false;
    dispatch(action);
    onStart();
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    const transport = { baseUrl: env.shareBase, auth: env.auth.kind, session };
    void pumpPlayground({
      exchangeId: action.exchangeId,
      request,
      transport,
      controller: next,
      dispatch,
    });
    return true;
  }

  function send(user: UserInput): boolean {
    const exchangeId = crypto.randomUUID();
    return start(
      { kind: "send", exchangeId, user, at: clockTime() },
      toPlaygroundRequest(state, user),
    );
  }

  function retry(exchange: Exchange) {
    const before = { exchanges: state.exchanges.slice(0, -1) };
    start({ kind: "retry", exchangeId: exchange.id }, toPlaygroundRequest(before, exchange.user));
  }

  return { state, send, retry };
}

function ExchangeView({
  exchange,
  last,
  locked,
  onSend,
  onRetry,
}: {
  exchange: Exchange;
  last: boolean;
  locked: boolean;
  onSend: (user: UserInput) => void;
  onRetry: (exchange: Exchange) => void;
}) {
  const { user } = exchange;
  return (
    <>
      {user.kind === "say" && (
        <UserTurn message={{ id: exchange.id, role: "user", text: user.text, time: exchange.at }} />
      )}
      <AgentReply
        turn={exchange.agent}
        actions={{
          locked,
          onSend,
          onRetry: last
            ? () => {
                onRetry(exchange);
              }
            : undefined,
        }}
      />
    </>
  );
}

/**
 * The live playground page (ADR-148): the user's messages go to the gateway, which runs the
 * model's tool loop and streams typed events back. `reducePlayground` holds all behaviour;
 * this component only dispatches, streams and renders. Nothing is saved.
 */
export function Playground() {
  const { scroller, onScroll, pin } = useStickToBottom();
  const { state, send, retry } = usePlaygroundReplies(pin);
  const [draft, setDraft] = useState("");
  const locked = isLocked(state);
  return (
    <div className="playground">
      <header className="pg-header">
        <h1>Playground</h1>
        <p>Live model. Nothing here is saved.</p>
      </header>
      <main className="pg-scroll" ref={scroller} onScroll={onScroll} aria-label="Conversation">
        {state.exchanges.length === 0 && (
          <p className="pg-empty">
            Ask for a chart of numbers you give it, or for a plan it can ask you about.
          </p>
        )}
        {state.exchanges.map((exchange, i) => (
          <ExchangeView
            key={exchange.id}
            exchange={exchange}
            last={i === state.exchanges.length - 1}
            locked={locked}
            onSend={(user) => {
              send(user);
            }}
            onRetry={retry}
          />
        ))}
      </main>
      <footer className="pg-compose" data-locked={locked || undefined}>
        <ComposeBox
          draft={draft}
          onDraftChange={setDraft}
          placeholder="Ask the live model"
          onSend={() => {
            if (send({ kind: "say", text: draft.trim() })) setDraft("");
          }}
        />
      </footer>
    </div>
  );
}
