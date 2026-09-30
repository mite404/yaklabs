/* oxlint-disable max-classes-per-file -- the two stream errors are one family, thrown here and told apart by failureCause */
import {
  playgroundEventSchema,
  type PlaygroundEvent,
  type PlaygroundRequest,
} from "@yaklabs/catalog/playground";
import type { Session } from "@yaklabs/runtime";
import type { AuthSource } from "../env";
import type { Cause, PlaygroundAction } from "./state";

/** Where a reply streams from: the gateway, the build's sign-in and the visitor's session. */
export type PlaygroundTransport = {
  baseUrl: string;
  auth: AuthSource["kind"];
  session: Session | undefined;
};

/** The gateway answered with a status other than 200; the body is never read. */
export class PlaygroundHttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`The playground answered ${String(status)}`);
    this.name = "PlaygroundHttpError";
    this.status = status;
  }
}

/** A stream line that is not JSON or not a playground event. */
export class PlaygroundProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlaygroundProtocolError";
  }
}

/**
 * Splits buffered stream text into whole lines and the partial line still arriving. Blank
 * lines are dropped.
 */
export function splitLines(buffered: string): { lines: string[]; rest: string } {
  const parts = buffered.split("\n"); // → string[], the last one maybe partial
  const rest = parts.pop() ?? "";
  return { lines: parts.filter((line) => line.trim() !== ""), rest };
}

const NOT_JSON = Symbol("not JSON");

function parseJson(line: string): unknown {
  try {
    return JSON.parse(line) as unknown;
  } catch {
    return NOT_JSON;
  }
}

function toEvent(raw: unknown): PlaygroundEvent {
  const parsed = playgroundEventSchema.safeParse(raw); // → typed event, or the issues
  if (!parsed.success) throw new PlaygroundProtocolError("A stream line is not a known event.");
  return parsed.data;
}

// One NDJSON line through the shared event schema; throws PlaygroundProtocolError when the
// line is not JSON or not a known event.
function parseEventLine(line: string): PlaygroundEvent {
  const raw = parseJson(line); // → unknown | NOT_JSON
  if (raw === NOT_JSON) throw new PlaygroundProtocolError("A stream line is not JSON.");
  return toEvent(raw);
}

// A last line with no newline is read only if it is whole JSON: one cut off mid-way means the
// connection dropped, which the reader learns from the stream ending without its `end` event.
function parseLastLine(line: string): PlaygroundEvent | undefined {
  if (line.trim() === "") return undefined;
  const raw = parseJson(line); // → unknown | NOT_JSON
  return raw === NOT_JSON ? undefined : toEvent(raw);
}

// A 401 means no sign-in in a build without one, which trying again cannot fix; with WorkOS
// it means the token expired, and trying again fetches a fresh one.
function unauthorized(auth: AuthSource["kind"]): Cause {
  if (auth === "none")
    return {
      title: "The playground needs sign-in, and this build has none.",
      detail: "",
      retry: false,
    };
  return { title: "Your sign-in expired.", detail: "Try again.", retry: true };
}

/**
 * What a failed stream tells the reader, or undefined when the page itself aborted it.
 * A rejected request, or sign-in in a build without it, cannot be fixed by trying again, so
 * they offer no retry.
 * @param auth The build's sign-in, which decides what a 401 means.
 */
export function failureCause(error: unknown, auth: AuthSource["kind"]): Cause | undefined {
  if (error instanceof DOMException && error.name === "AbortError") return undefined;
  if (error instanceof PlaygroundHttpError) {
    if (error.status === 401) return unauthorized(auth);
    if (error.status === 400)
      return {
        title: "The gateway did not accept this conversation.",
        detail: "Reload the page to start a new one.",
        retry: false,
      };
    return {
      title: "The reply could not start.",
      detail: `The gateway answered ${String(error.status)}.`,
      retry: true,
    };
  }
  if (error instanceof PlaygroundProtocolError)
    return { title: "The reply could not be read.", detail: error.message, retry: true };
  return {
    title: "The playground could not reach the gateway.",
    detail: "Check that the gateway is running, then try again.",
    retry: true,
  };
}

/**
 * Streams one reply from the gateway's POST /api/playground as validated events, in order.
 * A last line cut off mid-way is dropped, so a dropped connection reads as a short stream.
 * A bad line, or a reader that stops early, cancels the body so the gateway stops the turn.
 * @param token The session's bearer token; without one no Authorization header is sent.
 * @throws {PlaygroundHttpError} When the gateway answers anything but 200.
 * @throws {PlaygroundProtocolError} When a line is not a known event, or there is no body.
 */
export async function* readPlayground(
  baseUrl: string,
  request: PlaygroundRequest,
  token: string | undefined,
  signal: AbortSignal,
): AsyncGenerator<PlaygroundEvent> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  const url = new URL("/api/playground", baseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
    signal,
  });
  if (response.status !== 200) {
    void response.body?.cancel().catch(() => {});
    throw new PlaygroundHttpError(response.status);
  }
  if (response.body === null) throw new PlaygroundProtocolError("The reply has no body.");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffered = "";
  try {
    for (;;) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- a stream is read in order, one chunk at a time
      const chunk = await reader.read(); // → { done, value: string }
      if (chunk.done) break;
      const { lines, rest } = splitLines(buffered + chunk.value);
      buffered = rest;
      for (const line of lines) yield parseEventLine(line);
    }
    const last = parseLastLine(buffered); // → PlaygroundEvent | undefined
    if (last !== undefined) yield last;
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/**
 * Streams one reply into the page's reducer, then closes it or records why it broke. The
 * page aborting it (on leaving) is not a failure; any other failure aborts the request, so
 * the gateway stops spending model rounds on a reply nobody reads.
 */
export async function pumpPlayground({
  exchangeId,
  request,
  transport,
  controller,
  dispatch,
}: {
  exchangeId: string;
  request: PlaygroundRequest;
  transport: PlaygroundTransport;
  controller: AbortController;
  dispatch: (action: PlaygroundAction) => void;
}): Promise<void> {
  const { baseUrl, auth, session } = transport;
  try {
    const token = await session?.getAccessToken(); // → string | undefined
    for await (const event of readPlayground(baseUrl, request, token, controller.signal)) {
      dispatch({ kind: "event", exchangeId, event });
    }
    dispatch({ kind: "closed", exchangeId });
  } catch (error) {
    controller.abort();
    const cause = failureCause(error, auth); // → Cause | undefined
    if (cause !== undefined) dispatch({ kind: "broke", exchangeId, cause });
  }
}
