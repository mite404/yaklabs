import { randomUUID, timingSafeEqual } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { Selection } from "@yaklabs/catalog/catalog";

/** Limits for the in-memory relay; tests shorten the clocks. */
export type RelayOptions = {
  /** Open browser sessions at once. */
  maxSessions?: number;
  /** Hard lifetime of a browser session. */
  sessionTtlMs?: number;
  /** A session nobody polled for this long has a closed browser and ends. */
  idleMs?: number;
  /** How long insert_card waits for the browser's persistence acknowledgement. */
  ackTimeoutMs?: number;
};

/** What the browser receives from GET /sessions/:code/next. */
export type Delivery = { insertionId: string; card: Selection };

/** The browser's answer for one delivered card. */
export type Ack =
  | { insertionId: string; ok: true; threadId: string; messageId: string; note?: string }
  | { insertionId: string; ok: false; error: string };

/** How an insert_card call settled. */
export type InsertOutcome =
  | { ok: true; threadId: string; messageId: string; insertionId: string; note?: string }
  | { ok: false; error: string };

/** The outcome of recording an ack, for the HTTP status. */
export type AckOutcome = "accepted" | "not-pending" | "mismatch";

/** A browser session as the HTTP layer sees it after authorizing. */
export type SessionHandle = { readonly code: string };

/** The in-memory rendezvous between MCP calls and one browser tab per session. */
export type Relay = {
  /** Opens a session bound to one thread, or returns undefined when the cap is reached. */
  open(threadId: string): { code: string; browserToken: string; expiresAt: string } | undefined;
  /** Finds a live session by code and browser token and marks it active. */
  authorize(code: string, browserToken: string): SessionHandle | undefined;
  /** Hands the pending card to the browser once. */
  next(session: SessionHandle): Delivery | null;
  /** Settles the pending call from the browser's acknowledgement. */
  ack(session: SessionHandle, ack: Ack): AckOutcome;
  /** Ends a session; its pending call fails. */
  revoke(session: SessionHandle): void;
  /** Queues an accepted card for the session's browser and waits for its ack. */
  insert(
    connectionCode: string,
    insertionId: string,
    card: Selection,
    signal?: AbortSignal,
  ): Promise<InsertOutcome>;
  /** Ends every session and stops all timers. */
  close(): void;
};

type Pending = {
  insertionId: string;
  card: Selection;
  delivered: boolean;
  promise: Promise<InsertOutcome>;
  settle(outcome: InsertOutcome): void;
};

type Session = {
  code: string;
  browserToken: Buffer;
  threadId: string;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
  pending: Pending | undefined;
};

const DEFAULTS = {
  maxSessions: 32,
  sessionTtlMs: 15 * 60_000,
  idleMs: 10_000,
  ackTimeoutMs: 10_000,
} satisfies Required<RelayOptions>;

const NO_SESSION =
  "No Bonsai browser is connected with that connection code. It may be mistyped, expired, or " +
  "disconnected. Ask the user to turn on the MCP connection in Bonsai and give you the current " +
  "connection code.";

function sameToken(expected: Buffer, given: string): boolean {
  const candidate = Buffer.from(given);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function retryHint(insertionId: string): string {
  return `Retry insert_card with the same insertionId (${insertionId}) so Bonsai can drop a duplicate.`;
}

function endedMessage(pending: Pending): string {
  return pending.delivered
    ? `The Bonsai browser disconnected after receiving card ${pending.insertionId} but before ` +
        `confirming it was saved, so delivery is unknown. Once the user reconnects, ` +
        retryHint(pending.insertionId)
    : `The Bonsai browser session ended before card ${pending.insertionId} was delivered; it ` +
        `was not delivered. Ask the user to reconnect, then ${retryHint(pending.insertionId)}`;
}

function timeoutMessage(pending: Pending, ms: number): string {
  return pending.delivered
    ? `Bonsai received card ${pending.insertionId} but did not confirm it was saved within ` +
        `${ms / 1000}s, so delivery is unknown. ${retryHint(pending.insertionId)}`
    : `Bonsai did not pick up card ${pending.insertionId} within ${ms / 1000}s; it was not ` +
        `delivered. Check that the Bonsai tab is open, then ${retryHint(pending.insertionId)}`;
}

function mismatchMessage(insertionId: string): string {
  return (
    `Bonsai acknowledged card ${insertionId} for a different thread or message than this ` +
    `connection is bound to, so where it landed is unknown. ${retryHint(insertionId)}`
  );
}

/** Creates the relay. Nothing is persisted: sessions and cards live only in memory. */
export function createRelay(options: RelayOptions = {}): Relay {
  const limits = { ...DEFAULTS, ...options };
  const sessions = new Map<string, Session>();

  function end(session: Session) {
    clearTimeout(session.timer);
    sessions.delete(session.code);
    const { pending } = session;
    session.pending = undefined;
    pending?.settle({ ok: false, error: endedMessage(pending) });
  }

  // The session ends at whichever comes first: its lifetime or a gap in polling.
  function arm(session: Session) {
    clearTimeout(session.timer);
    const wait = Math.min(session.expiresAt - Date.now(), limits.idleMs);
    session.timer = setTimeout(
      () => {
        end(session);
      },
      Math.max(wait, 0),
    );
    session.timer.unref();
  }

  function live(code: string): Session | undefined {
    const session = sessions.get(code);
    if (session === undefined) return undefined;
    if (Date.now() >= session.expiresAt) {
      end(session);
      return undefined;
    }
    return session;
  }

  function settleOn(session: Session, pending: Pending, outcome: InsertOutcome) {
    if (session.pending === pending) session.pending = undefined;
    pending.settle(outcome);
  }

  function enqueue(session: Session, insertionId: string, card: Selection): Pending {
    const { promise, resolve: settle } = Promise.withResolvers<InsertOutcome>();
    let open = true;
    const pending: Pending = {
      insertionId,
      card,
      delivered: false,
      promise,
      settle(outcome) {
        if (!open) return;
        open = false;
        clearTimeout(timer);
        settle(outcome);
      },
    };
    const timer = setTimeout(() => {
      settleOn(session, pending, {
        ok: false,
        error: timeoutMessage(pending, limits.ackTimeoutMs),
      });
    }, limits.ackTimeoutMs);
    session.pending = pending;
    return pending;
  }

  return {
    open(threadId) {
      // oxlint-disable-next-line unicorn/no-useless-undefined -- consistent-return requires an explicit absent result
      if (sessions.size >= limits.maxSessions) return undefined;
      const code = randomUUID();
      const browserToken = randomUUID();
      const expiresAt = Date.now() + limits.sessionTtlMs;
      const session: Session = {
        code,
        browserToken: Buffer.from(browserToken),
        threadId,
        expiresAt,
        timer: setTimeout(() => {}, 0),
        pending: undefined,
      };
      sessions.set(code, session);
      arm(session);
      return { code, browserToken, expiresAt: new Date(expiresAt).toISOString() };
    },

    authorize(code, browserToken) {
      const session = live(code);
      // oxlint-disable-next-line unicorn/no-useless-undefined -- consistent-return requires an explicit absent result
      if (session === undefined || !sameToken(session.browserToken, browserToken)) return undefined;
      arm(session);
      return { code };
    },

    next({ code }) {
      const pending = sessions.get(code)?.pending;
      if (pending === undefined || pending.delivered) return null;
      pending.delivered = true;
      return { insertionId: pending.insertionId, card: pending.card };
    },

    ack({ code }, ack) {
      const session = sessions.get(code);
      const pending = session?.pending;
      if (session === undefined || pending === undefined) return "not-pending";
      if (pending.insertionId !== ack.insertionId || !pending.delivered) return "not-pending";
      if (!ack.ok) {
        settleOn(session, pending, {
          ok: false,
          error: `Bonsai could not add card ${ack.insertionId}: ${ack.error}`,
        });
        return "accepted";
      }
      if (ack.threadId !== session.threadId || ack.messageId !== `mcp:${ack.insertionId}`) {
        settleOn(session, pending, { ok: false, error: mismatchMessage(ack.insertionId) });
        return "mismatch";
      }
      settleOn(session, pending, ack);
      return "accepted";
    },

    revoke({ code }) {
      const session = sessions.get(code);
      if (session !== undefined) end(session);
    },

    insert(connectionCode, insertionId, card, signal) {
      if (signal?.aborted === true)
        return Promise.resolve({
          ok: false,
          error: `The call was cancelled; card ${insertionId} was not delivered.`,
        });
      const session = live(connectionCode);
      if (session === undefined) return Promise.resolve({ ok: false, error: NO_SESSION });
      const current = session.pending;
      if (current !== undefined) {
        if (current.insertionId === insertionId) {
          return isDeepStrictEqual(current.card, card)
            ? current.promise
            : Promise.resolve({
                ok: false,
                error: `Insertion ${insertionId} already holds a different card.`,
              });
        }
        return Promise.resolve({
          ok: false,
          error:
            `Card ${current.insertionId} is already waiting for Bonsai on this connection. ` +
            "Wait for that call to finish, then insert the next card.",
        });
      }
      const pending = enqueue(session, insertionId, card);
      // A cancelled call withdraws a card the browser has not taken yet.
      const abort = () => {
        settleOn(session, pending, {
          ok: false,
          error: pending.delivered
            ? `The call was cancelled after Bonsai received card ${insertionId}; delivery is unknown. ${retryHint(insertionId)}`
            : `The call was cancelled; card ${insertionId} was not delivered.`,
        });
      };
      signal?.addEventListener("abort", abort, { once: true });
      void pending.promise.finally(() => signal?.removeEventListener("abort", abort));
      return pending.promise;
    },

    close() {
      for (const session of sessions.values()) end(session);
    },
  };
}
