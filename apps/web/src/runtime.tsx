import { startRuntime, type Runtime, type RuntimeData, type RuntimeState } from "@yaklabs/runtime";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import { env } from "./env";
import { legacyFrom, unknownScenario, wantedFrom, type Wanted } from "./source";

// The runtime the page started, what the address asked it to open, and how to start it again.
type Door = { runtime: Runtime | null; wanted: Wanted; restart: (() => void) | null };
// What a runtime can open: the device, or a scenario that exists.
type Openable = Exclude<Wanted, { kind: "unknown" }>;

// The v1 canvas's two keys (ADR-089), which the worker's 1 → 2 migration reads once.
const LEGACY_HIDDEN = "kay.canvas.hidden";
const LEGACY_ORDER = "kay.canvas.order";

const DoorContext = createContext<Door | null>(null);

/** Why something failed, in words fit for the page. */
export function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Lets a write to the worker run on its own. The snapshot already shows it; if the worker
 * refuses it, the next state rolls it back and a toast says what did not happen.
 */
export function inBackground(write: Promise<unknown>, doing: string): void {
  write.catch((error: unknown) => {
    toast.error(`${doing} did not work`, { description: reasonOf(error) });
  });
}

// A browser that refuses storage has no v1 keys to send.
function readLegacy(): RuntimeData {
  try {
    const legacy = legacyFrom(
      localStorage.getItem(LEGACY_HIDDEN),
      localStorage.getItem(LEGACY_ORDER),
    );
    return { kind: "device", legacy };
  } catch {
    return { kind: "device" };
  }
}

function clearLegacy(): void {
  try {
    localStorage.removeItem(LEGACY_HIDDEN);
    localStorage.removeItem(LEGACY_ORDER);
  } catch {
    // Nothing was readable, so nothing is left to clear.
  }
}

// The keys go only once the file on disk has opened: a memory store never migrated them, and a
// later visit that reaches the file still needs them.
function clearLegacyOnceKept(runtime: Runtime): () => void {
  return runtime.subscribe(() => {
    const state = runtime.state();
    if (state.kind === "ready" && state.source.kind === "device" && state.source.storage === "opfs")
      clearLegacy();
  });
}

// What the state is before a runtime answers: starting (with the scenario it will say, if
// any), or broken for good when the address names a scenario that does not exist.
function stateBefore(wanted: Wanted): RuntimeState {
  switch (wanted.kind) {
    case "device":
      return { kind: "starting", source: null };
    case "scenario":
      return { kind: "starting", source: { kind: "scenario", name: wanted.name } };
    case "unknown":
      return { kind: "broken", source: null, reason: unknownScenario(wanted.name) };
    default: {
      const unhandled: never = wanted;
      return unhandled;
    }
  }
}

function useDoor(): Door {
  const door = useContext(DoorContext);
  if (door === null) throw new Error("The runtime hooks need <RuntimeProvider> above them");
  return door;
}

// One runtime's life: started in an effect with a cleanup, never in a state initializer, so
// StrictMode's second mount stops the first worker before the second opens the device's file.
function RuntimeHost({
  wanted,
  restart,
  children,
}: {
  wanted: Openable;
  restart: () => void;
  children: ReactNode;
}) {
  const [runtime, setRuntime] = useState<Runtime | null>(null);

  useEffect(() => {
    const data: RuntimeData =
      wanted.kind === "device" ? readLegacy() : { kind: "scenario", name: wanted.name };
    const started = startRuntime({ agent: env.agent, data });
    if (wanted.kind === "device") void navigator.storage.persist(); // ADR-081: keep the file
    const stopClearing = clearLegacyOnceKept(started);
    // oxlint-disable-next-line react/set-state-in-effect -- the worker is the external system this effect starts; render needs its handle
    setRuntime(started);
    return () => {
      stopClearing();
      started.dispose();
      setRuntime(null);
    };
  }, [wanted]);

  const door = useMemo<Door>(() => ({ runtime, wanted, restart }), [runtime, wanted, restart]);
  return <DoorContext value={door}>{children}</DoorContext>;
}

/**
 * Runs the worker for as long as the workspace is on screen (ADR-076), on the data the address
 * asks for: `?scenario=<name>` opens that mock (ADR-096), anything else the device's store. A
 * restart is a new runtime and a new page beneath it, so nothing keeps the failed one's state.
 */
export function RuntimeProvider({ children }: { children: ReactNode }) {
  const { search } = useLocation();
  const wanted = useMemo(() => wantedFrom(search), [search]); // → Wanted
  const [attempt, setAttempt] = useState(0);
  const restart = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);
  // An unknown scenario opens nothing, and trying again cannot change that.
  const refused = useMemo<Door>(() => ({ runtime: null, wanted, restart: null }), [wanted]);
  if (wanted.kind === "unknown") return <DoorContext value={refused}>{children}</DoorContext>;
  return (
    <RuntimeHost key={attempt} wanted={wanted} restart={restart}>
      {children}
    </RuntimeHost>
  );
}

/** The runtime's state, re-rendering on every change: starting until the worker has started. */
export function useRuntimeState(): RuntimeState {
  const { runtime, wanted } = useDoor();
  const before = useMemo(() => stateBefore(wanted), [wanted]);
  const subscribe = useCallback(
    (listener: () => void) => runtime?.subscribe(listener) ?? (() => {}),
    [runtime],
  );
  const snapshot = useCallback(() => runtime?.state() ?? before, [runtime, before]);
  return useSyncExternalStore(subscribe, snapshot);
}

/**
 * The runtime's verbs, for the parts of the page drawn once it is ready.
 * @throws Before the worker has started, which no ready view can reach.
 */
export function useRuntime(): Runtime {
  const { runtime } = useDoor();
  if (runtime === null) throw new Error("useRuntime needs a started runtime");
  return runtime;
}

/** Starts the runtime again after a failed start; null when trying again cannot help. */
export function useRestart(): (() => void) | null {
  return useDoor().restart;
}
