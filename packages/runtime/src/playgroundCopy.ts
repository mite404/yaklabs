import type { Failure } from "@yaklabs/catalog/reply";

// Every sentence the live agent writes for the reader, in one table (ADR-040): plain words,
// never a status code or a gateway body. A failure's title is the line the thread keeps; its
// detail says what to do next.

/** The live agent's words: how each failure reads, and the lines it adds to Technical details. */
export const COPY = {
  /** No token to send, so nothing was sent, and asking again cannot help. */
  signIn: {
    title: "Sign-in needed",
    detail: "The live model answers signed-in visitors only, and this session has no sign-in.",
    retry: false,
  },
  /** The gateway refused the token it was sent. */
  expired: {
    title: "Your sign-in expired",
    detail: "Try again to sign in afresh.",
  },
  /** The gateway, or the check before sending, could not accept the conversation as it is. */
  rejected: {
    title: "Message not accepted",
    detail:
      "The live model could not read this conversation. Shorten a long message, or start a new thread.",
    retry: false,
  },
  /** The gateway answered anything else before a byte, or could not be reached. */
  unavailable: {
    title: "The live model is unavailable",
    detail: "The gateway could not reach it. Try again in a moment.",
  },
  /** The stream broke: an unreadable or missing line, or a body that closed before `end`. */
  cutOff: {
    title: "Reply cut off",
    detail: "The connection dropped before the reply finished. Try again.",
  },
  /** The gateway speaks another protocol version than this page. */
  version: {
    title: "Page out of date",
    detail: "This page and the live model's gateway speak different versions. Reload the page.",
  },
  /** How a reply the gateway ended short reads; `detail` stands in when `end` has no line. */
  ended: {
    limit: { title: "Reply cut short", detail: "I stopped before finishing this reply." },
    upstream: { title: "The live model stopped", detail: "The model stopped responding." },
  },
  /** The technical line for the gateway's note on a card. */
  cardNote: (cardId: string, note: string): string => `Card ${cardId}: ${note}`,
} as const satisfies Record<
  string,
  Failure | Record<string, Failure> | ((...args: string[]) => string)
>;
