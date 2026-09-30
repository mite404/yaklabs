import type { PlaygroundEvent, PlaygroundRequest } from "@yaklabs/catalog/playground";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlaygroundAction } from "./state";
import {
  PlaygroundHttpError,
  PlaygroundProtocolError,
  failureCause,
  pumpPlayground,
  readPlayground,
  splitLines,
} from "./stream";

const REQUEST: PlaygroundRequest = { exchanges: [{ user: { kind: "say", text: "hi" } }] };
const encoder = new TextEncoder();

// A response whose body arrives as exactly these byte chunks.
function chunked(chunks: Uint8Array[], status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Response(body, { status });
}

// A 200 response that sends `text` and then stays open, recording whether it was cancelled.
function heldOpen(text: string) {
  const cancelled = { value: false };
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
    },
    cancel() {
      cancelled.value = true;
    },
  });
  return { response: new Response(body, { status: 200 }), cancelled };
}

// Stubs fetch with one response, recording what was asked of it.
function serve(response: Response) {
  const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(response));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

async function collect(token?: string): Promise<PlaygroundEvent[]> {
  const events: PlaygroundEvent[] = [];
  const signal = new AbortController().signal;
  for await (const event of readPlayground("https://gateway.test", REQUEST, token, signal)) {
    events.push(event);
  }
  return events;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("splitLines", () => {
  it("keeps the partial last line for the next chunk and drops blank lines", () => {
    expect(splitLines('{"a":1}\n\n{"b"')).toEqual({ lines: ['{"a":1}'], rest: '{"b"' });
  });
});

describe("readPlayground", () => {
  it("joins lines and multi-byte characters split across chunks", async () => {
    const text = `${JSON.stringify({ type: "start", seq: 0, v: 1 })}\n${JSON.stringify({
      type: "text",
      seq: 1,
      blockId: "b0",
      delta: "café",
    })}\n${JSON.stringify({ type: "end", seq: 2, reason: "answered" })}`;
    const bytes = encoder.encode(text);
    const cut = bytes.indexOf(0xc3) + 1; // inside the two-byte "é"
    serve(chunked([bytes.slice(0, 10), bytes.slice(10, cut), bytes.slice(cut)]));
    const events = await collect();
    expect(events.map((event) => event.type)).toEqual(["start", "text", "end"]);
    expect(events[1]).toMatchObject({ delta: "café" });
  });

  it("reads a whole last line without a newline and drops one cut off mid-way", async () => {
    const start = JSON.stringify({ type: "start", seq: 0, v: 1 });
    serve(chunked([encoder.encode(start)]));
    expect(await collect()).toHaveLength(1);
    serve(chunked([encoder.encode(`${start}\n{"seq":1,"type":"text","blockId":"b0","del`)]));
    expect(await collect()).toHaveLength(1);
  });

  it("posts the request with a bearer token only when there is one", async () => {
    const withToken = serve(chunked([]));
    await collect("secret");
    expect(withToken.mock.calls[0]?.[1]?.headers).toMatchObject({ authorization: "Bearer secret" });
    expect(withToken.mock.calls[0]?.[0]).toEqual(new URL("https://gateway.test/api/playground"));
    const without = serve(chunked([]));
    await collect();
    expect(without.mock.calls[0]?.[1]?.headers).not.toHaveProperty("authorization");
  });

  it("throws the status of a non-200 answer without reading its body", async () => {
    const response = chunked([encoder.encode("secret upstream detail")], 502);
    serve(response);
    const error: unknown = await collect().catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(PlaygroundHttpError);
    expect(error).toMatchObject({ status: 502 });
    expect(String(error)).not.toContain("secret");
  });

  it("throws on a line that is not JSON or not a known event", async () => {
    serve(chunked([encoder.encode("not json\n")]));
    await expect(collect()).rejects.toBeInstanceOf(PlaygroundProtocolError);
    serve(chunked([encoder.encode(`${JSON.stringify({ type: "start", seq: 0, v: 2 })}\n`)]));
    await expect(collect()).rejects.toBeInstanceOf(PlaygroundProtocolError);
  });
});

describe("readPlayground stops the gateway", () => {
  it("by cancelling the body when a line is not a known event", async () => {
    const { response, cancelled } = heldOpen("not json\n");
    serve(response);
    await expect(collect()).rejects.toBeInstanceOf(PlaygroundProtocolError);
    await vi.waitFor(() => {
      expect(cancelled.value).toBe(true);
    });
  });

  it("by cancelling the body when the reader stops early", async () => {
    const { response, cancelled } = heldOpen(
      `${JSON.stringify({ type: "start", seq: 0, v: 1 })}\n`,
    );
    serve(response);
    const signal = new AbortController().signal;
    const events = readPlayground("https://gateway.test", REQUEST, undefined, signal);
    const first = await events.next();
    expect(first.value).toMatchObject({ type: "start" });
    await events.return(null);
    await vi.waitFor(() => {
      expect(cancelled.value).toBe(true);
    });
  });

  it("parses an unterminated last line once", async () => {
    serve(chunked([encoder.encode(JSON.stringify({ type: "start", seq: 0, v: 1 }))]));
    const parse = vi.spyOn(JSON, "parse");
    await collect();
    expect(parse).toHaveBeenCalledTimes(1);
  });
});

describe("pumpPlayground", () => {
  it("aborts the exchange's request when its stream breaks", async () => {
    serve(chunked([encoder.encode("not json\n")]));
    const controller = new AbortController();
    const actions: PlaygroundAction[] = [];
    await pumpPlayground({
      exchangeId: "x1",
      request: REQUEST,
      transport: { baseUrl: "https://gateway.test", auth: "none", session: undefined },
      controller,
      dispatch: (action) => {
        actions.push(action);
      },
    });
    expect(controller.signal.aborted).toBe(true);
    expect(actions).toMatchObject([
      { kind: "broke", cause: { title: "The reply could not be read." } },
    ]);
  });
});

describe("failureCause", () => {
  it("offers no retry for a rejected request, and a retry otherwise", () => {
    expect(failureCause(new PlaygroundHttpError(400), "none")?.retry).toBe(false);
    expect(failureCause(new PlaygroundHttpError(502), "none")?.retry).toBe(true);
    expect(failureCause(new PlaygroundProtocolError("bad line"), "none")?.retry).toBe(true);
    expect(failureCause(new TypeError("Failed to fetch"), "none")?.retry).toBe(true);
  });

  it("explains a 401 by the build: no sign-in to fix, or a sign-in to renew", () => {
    expect(failureCause(new PlaygroundHttpError(401), "none")).toEqual({
      title: "The playground needs sign-in, and this build has none.",
      detail: "",
      retry: false,
    });
    expect(failureCause(new PlaygroundHttpError(401), "workos")).toEqual({
      title: "Your sign-in expired.",
      detail: "Try again.",
      retry: true,
    });
  });

  it("says nothing when the page aborted the stream itself", () => {
    expect(failureCause(new DOMException("aborted", "AbortError"), "none")).toBeUndefined();
  });
});
