/* oxlint-disable max-classes-per-file -- the two stream errors are one family, thrown here and told apart by failureCause */
import {
  playgroundEventSchema,
  type PlaygroundEvent,
  type PlaygroundRequest,
} from "@yaklabs/catalog/playground";
import type { Cause } from "./state";

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

/**
 * Parses one NDJSON line with the shared event schema.
 * @throws {PlaygroundProtocolError} When the line is not JSON or not a known event.
 */
export function parseEventLine(line: string): PlaygroundEvent {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    throw new PlaygroundProtocolError("A stream line is not JSON.");
  }
  const parsed = playgroundEventSchema.safeParse(raw); // → typed event, or the issues
  if (!parsed.success) throw new PlaygroundProtocolError("A stream line is not a known event.");
  return parsed.data;
}

// A last line with no newline is read only if it is whole JSON: one cut off mid-way means the
// connection dropped, which the reader learns from the stream ending without its `end` event.
function isWholeLine(line: string): boolean {
  try {
    JSON.parse(line);
    return true;
  } catch {
    return false;
  }
}

/**
 * What a failed stream tells the reader, or undefined when the page itself aborted it.
 * Sign-in and a rejected request cannot be fixed by trying again, so they offer no retry.
 */
export function failureCause(error: unknown): Cause | undefined {
  if (error instanceof DOMException && error.name === "AbortError") return undefined;
  if (error instanceof PlaygroundHttpError) {
    if (error.status === 401)
      return {
        title: "The playground needs sign-in, and this build has none.",
        detail: "",
        retry: false,
      };
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
  for (;;) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- a stream is read in order, one chunk at a time
    const chunk = await reader.read(); // → { done, value: string }
    if (chunk.done) break;
    const { lines, rest } = splitLines(buffered + chunk.value);
    buffered = rest;
    for (const line of lines) yield parseEventLine(line);
  }
  if (buffered.trim() !== "" && isWholeLine(buffered)) yield parseEventLine(buffered);
}
