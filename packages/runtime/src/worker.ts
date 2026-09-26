/// <reference lib="webworker" />
import { createAgentLoop } from "./agentLoop";
import type { StorageKind } from "./protocol";
import { openSqliteStore } from "./sqliteStore";
import { createMemoryStore, type ConversationStore } from "./store";

// This file only ever runs as the dedicated worker `startRuntime` creates (ADR-083).
declare const self: DedicatedWorkerGlobalScope;

// The one database the app keeps its conversations in (ADR-081).
const DATABASE = "yaklabs";

// SQLite in the private file system when the browser allows it; memory otherwise, which the
// page learns from `ready.storage`.
async function openStore(): Promise<{ store: ConversationStore; storage: StorageKind }> {
  try {
    return { store: await openSqliteStore({ kind: "opfs", name: DATABASE }), storage: "opfs" };
  } catch (error) {
    // oxlint-disable-next-line no-console -- the one place a worker can say why it fell back
    console.warn(
      "[runtime] Conversations stay in memory: the private file system is unavailable.",
      error,
    );
    return { store: createMemoryStore(), storage: "memory" };
  }
}

const handle = createAgentLoop({
  post: (notice) => {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- workers have none
    self.postMessage(notice);
  },
  openStore,
});

self.addEventListener("message", (event) => {
  void handle(event.data);
});
