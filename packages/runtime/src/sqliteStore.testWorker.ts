/// <reference lib="webworker" />
import { z } from "zod";
import { conversationSchema, type Conversation } from "./protocol";
import { openSqliteStore } from "./sqliteStore";

// Started only by sqliteStore.browser.test.ts: OPFS's fast mode exists only inside a Worker.
declare const self: DedicatedWorkerGlobalScope;

// What the test asks for: save then reopen in this worker, or read what an earlier one saved.
const requestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("save-then-reopen"),
    name: z.string(),
    conversation: conversationSchema,
  }),
  z.object({ kind: z.literal("read"), name: z.string(), id: z.string() }),
]);
type Request = z.infer<typeof requestSchema>;

async function saveThenReopen(name: string, conversation: Conversation) {
  const first = await openSqliteStore({ kind: "opfs", name });
  await first.save(conversation);
  first.close();
  const second = await openSqliteStore({ kind: "opfs", name }); // a new instance, same file
  try {
    return await second.open(conversation.id);
  } finally {
    second.close();
  }
}

async function read(name: string, id: string) {
  const store = await openSqliteStore({ kind: "opfs", name });
  try {
    return await store.open(id);
  } finally {
    store.close();
  }
}

function run(request: Request): Promise<Conversation | undefined> {
  return request.kind === "read"
    ? read(request.name, request.id)
    : saveThenReopen(request.name, request.conversation);
}

async function answer(data: unknown): Promise<void> {
  try {
    const conversation = await run(requestSchema.parse(data)); // → Conversation | undefined
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- workers have none
    self.postMessage({ ok: true, conversation: conversation ?? null });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- workers have none
    self.postMessage({ ok: false, reason });
  }
}

self.addEventListener("message", (event) => {
  void answer(event.data);
});
