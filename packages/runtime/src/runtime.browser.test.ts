import type { AgentEvent } from "@yaklabs/catalog/agent";
import { describe, expect, it, onTestFinished } from "vitest";
import { startRuntime, type Runtime } from "./runtime";
import { netProfitChoice, profitThread } from "./testing";

// The user stepped the profit card to net profit, then asked about it.
const question = "Why is Saturday high?";
const ask: AgentEvent = { kind: "message", text: question, attachments: [netProfitChoice] };
// Turn times read like the seeds': "9:02", "10:02".
const clockTime: unknown = expect.stringMatching(/^\d{1,2}:\d{2}$/);

// A runtime on the lab stand-in at its real pace, stopped when the test ends.
function startLab(): Runtime {
  const runtime = startRuntime({ agent: { kind: "lab" } });
  onTestFinished(() => {
    runtime.dispose();
  });
  return runtime;
}

async function collect(pieces: AsyncIterable<string>): Promise<string[]> {
  const collected: string[] = [];
  for await (const piece of pieces) collected.push(piece);
  return collected;
}

describe("the runtime in a Web Worker", () => {
  it("streams a reply about the card view and keeps the thread across workers", async () => {
    // A fresh id, so a rerun in the same browser profile starts from the seed again.
    const id = `demo-${crypto.randomUUID()}`;
    const first = startLab();
    expect(await first.ready).toEqual({ storage: "opfs" });
    expect((await first.open(id, profitThread)).messages).toEqual(profitThread.messages);

    const pieces = await collect(first.agent(id).respond(ask, new AbortController().signal));
    const reply = pieces.join("");
    expect(pieces.length).toBeGreaterThan(1);
    expect(reply).toContain("Net profit");

    const kept = await first.open(id);
    expect(kept.messages).toEqual([
      ...profitThread.messages,
      { id: "u2", role: "user", text: question, time: clockTime, attachments: [netProfitChoice] },
      { id: "a2", role: "agent", text: reply, time: clockTime },
    ]);
    first.dispose();

    const second = startLab();
    expect(await second.ready).toEqual({ storage: "opfs" });
    expect((await second.open(id)).messages).toEqual(kept.messages);
    expect((await second.list()).map((summary) => summary.id)).toContain(id);
  }, 20_000);

  it("falls back to memory in a second worker while the first holds the database", async () => {
    const first = startLab();
    expect(await first.ready).toEqual({ storage: "opfs" });
    const second = startLab(); // a second tab, say
    expect(await second.ready).toEqual({ storage: "memory" });
  }, 20_000);

  it("stops a reply when the page aborts it", async () => {
    const id = `abort-${crypto.randomUUID()}`;
    const runtime = startLab();
    await runtime.open(id, profitThread);
    const controller = new AbortController();
    const pieces: string[] = [];
    for await (const piece of runtime.agent(id).respond(ask, controller.signal)) {
      pieces.push(piece);
      controller.abort();
    }
    expect(pieces).toHaveLength(1);
  }, 20_000);
});
