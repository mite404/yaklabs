import { startRuntime, type Runtime, type RuntimeState } from "@yaklabs/runtime";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { env } from "./env";

// What the page shows before the worker it started has said anything.
const STARTING: RuntimeState = { kind: "starting", source: null };

const RuntimeContext = createContext<Runtime | null>(null);

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

/**
 * Starts the worker for as long as the workspace is on screen (ADR-076). It starts in an effect
 * with a cleanup, never in a state initializer, so StrictMode's second mount stops the first
 * worker before the second opens the device's database.
 */
export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  useEffect(() => {
    const started = startRuntime({ agent: env.agent, data: { kind: "device" } });
    void navigator.storage.persist(); // ADR-081: ask the browser to keep the database
    // oxlint-disable-next-line react/set-state-in-effect -- the worker is the external system this effect starts; render needs its handle
    setRuntime(started);
    return () => {
      started.dispose();
    };
  }, []);
  return <RuntimeContext value={runtime}>{children}</RuntimeContext>;
}

/**
 * The runtime's state, re-rendering on every change: starting until the worker has started.
 */
export function useRuntimeState(): RuntimeState {
  const runtime = useContext(RuntimeContext);
  const subscribe = useCallback(
    (listener: () => void) => runtime?.subscribe(listener) ?? (() => {}),
    [runtime],
  );
  const snapshot = useCallback(() => runtime?.state() ?? STARTING, [runtime]);
  return useSyncExternalStore(subscribe, snapshot);
}

/**
 * The runtime's verbs, for the parts of the page drawn once it is ready.
 * @throws Before the worker has started, which no ready view can reach.
 */
export function useRuntime(): Runtime {
  const runtime = useContext(RuntimeContext);
  if (runtime === null) throw new Error("useRuntime needs a started runtime");
  return runtime;
}
