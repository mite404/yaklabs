import type { PlaygroundEvent, PlaygroundRequest } from "@yaklabs/catalog/playground";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PlaygroundHttpError,
  PlaygroundProtocolError,
  failureCause,
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

describe("failureCause", () => {
  it("offers no retry for sign-in or a rejected request, and a retry otherwise", () => {
    expect(failureCause(new PlaygroundHttpError(401))).toEqual({
      title: "The playground needs sign-in, and this build has none.",
      detail: "",
      retry: false,
    });
    expect(failureCause(new PlaygroundHttpError(400))?.retry).toBe(false);
    expect(failureCause(new PlaygroundHttpError(502))?.retry).toBe(true);
    expect(failureCause(new PlaygroundProtocolError("bad line"))?.retry).toBe(true);
    expect(failureCause(new TypeError("Failed to fetch"))?.retry).toBe(true);
  });

  it("says nothing when the page aborted the stream itself", () => {
    expect(failureCause(new DOMException("aborted", "AbortError"))).toBeUndefined();
  });
});
