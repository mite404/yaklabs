/// <reference lib="webworker" />
import { createAgentLoop, type Opened } from "./agentLoop";
import { liveMint } from "./mint";
import type { LegacyCanvas, RuntimeData, ScenarioName, Source } from "./protocol";
import { openSqliteStore, StorageUnavailableError } from "./sqliteStore";
import { ensureStarter, type Store } from "./store";

// This file only ever runs as the dedicated worker `startRuntime` creates (ADR-083).
declare const self: DedicatedWorkerGlobalScope;

// The one database the app keeps its threads in (ADR-081).
const DATABASE = "yaklabs";

// SQLite in the private file system when the browser allows it; memory otherwise, which the
// page learns from the source. Only the file on disk may migrate the v1 canvas keys: a memory
// store starts empty, so the page keeps the keys for a later run that reaches the file. A file
// that opened but cannot be read or migrated is not a refused file system: falling back would
// hide the threads it holds behind a fresh starter, so that start breaks with its reason.
async function openDeviceStore(
  legacy: LegacyCanvas | undefined,
): Promise<{ store: Store; source: Source }> {
  try {
    const store = await openSqliteStore({ kind: "opfs", name: DATABASE }, legacy);
    return { store, source: { kind: "device", storage: "opfs" } };
  } catch (error) {
    if (!(error instanceof StorageUnavailableError)) throw error;
    // oxlint-disable-next-line no-console -- the one place a worker can say why it fell back
    console.warn("[runtime] Threads stay in memory.", error.message);
    const store = await openSqliteStore({ kind: "memory" });
    return { store, source: { kind: "device", storage: "memory" } };
  }
}

async function openDevice(legacy: LegacyCanvas | undefined): Promise<Opened> {
  const mint = liveMint();
  const { store, source } = await openDeviceStore(legacy);
  ensureStarter(store, mint.now().toISOString());
  return { store, source, mint, faults: {} };
}

// A scenario's fixtures load only when one is asked for, so the device never ships them.
async function openScenario(name: ScenarioName): Promise<Opened> {
  const scenarios = await import("./scenarios");
  return scenarios.openScenario(name);
}

function open(data: RuntimeData): Promise<Opened> {
  return data.kind === "device" ? openDevice(data.legacy) : openScenario(data.name);
}

const handle = createAgentLoop({
  post: (notice) => {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- workers have none
    self.postMessage(notice);
  },
  open,
});

self.addEventListener("message", (event) => {
  void handle(event.data);
});
