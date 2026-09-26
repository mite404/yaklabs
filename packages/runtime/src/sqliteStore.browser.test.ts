import { describe, expect, it } from "vitest";
import { z } from "zod";
import { conversationSchema, type Conversation } from "./protocol";
import { openSqliteStore } from "./sqliteStore";
import { netProfitChoice, profitThread } from "./testing";

const demo: Conversation = {
  id: "demo",
  title: profitThread.title,
  updatedAt: "2026-09-26T10:03:00.000Z",
  messages: [
    ...profitThread.messages,
    {
      id: "u2",
      role: "user",
      text: "Why is Saturday high?",
      time: "10:03",
      attachments: [netProfitChoice],
    },
  ],
};

// What the test worker answers.
const replySchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), conversation: conversationSchema.nullable() }),
  z.object({ ok: z.literal(false), reason: z.string() }),
]);

// Runs one request in a fresh worker, then ends that worker the way closing a tab would.
async function inFreshWorker(request: unknown): Promise<z.infer<typeof replySchema>> {
  const url = new URL("./sqliteStore.testWorker.ts", import.meta.url);
  const worker = new Worker(url, { type: "module" });
  try {
    const data = await new Promise<unknown>((resolve, reject) => {
      worker.addEventListener("message", (event) => {
        resolve(event.data);
      });
      worker.addEventListener("error", () => {
        reject(new Error("The test worker failed"));
      });
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- workers have none
      worker.postMessage(request);
    });
    return replySchema.parse(data);
  } finally {
    worker.terminate();
  }
}

describe("SQLite store in the browser's private file system", () => {
  it("reads a conversation back from a new store on the same file", async () => {
    const name = `store-${crypto.randomUUID().slice(0, 8)}`;
    const reply = await inFreshWorker({ kind: "save-then-reopen", name, conversation: demo });
    expect(reply).toEqual({ ok: true, conversation: demo });
  });

  it("still has it in the next worker, after the first one is gone", async () => {
    const name = `store-${crypto.randomUUID().slice(0, 8)}`;
    await inFreshWorker({ kind: "save-then-reopen", name, conversation: demo });
    expect(await inFreshWorker({ kind: "read", name, id: "demo" })).toEqual({
      ok: true,
      conversation: demo,
    });
  });

  it("refuses the private file system outside a Worker, so the runtime can fall back", async () => {
    await expect(openSqliteStore({ kind: "opfs", name: "main-thread" })).rejects.toThrow(
      "Missing required OPFS APIs",
    );
  });
});
