import type { ThreadId } from "@yaklabs/runtime";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { matchPath } from "react-router";
import { PanelRegistryProvider, type PanelRegistry } from "../components/panel-registry";
import { ProvidedRuntime, type Paths } from "../runtime";
import { createClock, type Rate } from "./clock";
import { createPlayer, type Player } from "./player";
import { createDemoRuntime, type DemoRuntime } from "./runtime";
import type { Script } from "./script";

/** What the demo's controls work with: the script, its player once started, and the page's own. */
export type Demo = {
  script: Script;
  /** Null for the first frame, before the demo's effect has started it. */
  player: Player | null;
  rate: Rate;
  setRate: (rate: Rate) => void;
  /** Plays the script again from the start, on a fresh workspace. */
  restart: () => void;
};

// One playthrough's parts: they live and die together.
type Parts = { runtime: DemoRuntime; player: Player };

/** Where the demo lives; every one of its addresses is under here. */
export const DEMO_BASE = "/demo/weekly-brief";

const DemoContext = createContext<Demo | null>(null);

/**
 * The demo's addresses, each keeping `?script=`, so a link inside it never leaves its scenario:
 * a thread under the demo, home as the demo's own address, and the Lab as the app's.
 */
export function demoPaths(script: Script): Paths {
  const search = `?${new URLSearchParams({ script: script.id }).toString()}`;
  return {
    pathTo: (id: ThreadId) => `${DEMO_BASE}/t/${encodeURIComponent(id)}${search}`,
    hrefTo: (path) => (path === "/" ? `${DEMO_BASE}${search}` : "/lab"),
    threadIdOf: (pathname) => matchPath(`${DEMO_BASE}/t/:threadId`, pathname)?.params.threadId,
  };
}

// One playthrough, started in an effect with a cleanup, never in a state initializer, so
// StrictMode's second mount stops the first player before the second one plays.
function useParts(script: Script, registry: PanelRegistry, rate: Rate): Parts | null {
  const [parts, setParts] = useState<Parts | null>(null);
  useEffect(() => {
    const clock = createClock();
    const runtime = createDemoRuntime(script, clock);
    const player = createPlayer({ script, runtime, clock, panels: registry });
    // oxlint-disable-next-line react/set-state-in-effect -- the playthrough is the external system this effect starts; render needs its handles
    setParts({ runtime, player });
    return () => {
      player.dispose();
      runtime.dispose();
      setParts(null);
    };
  }, [script, registry]);
  useEffect(() => {
    parts?.player.setRate(rate);
  }, [parts, rate]);
  return parts;
}

/**
 * Runs one playthrough of `script` for as long as it is mounted (key it by the script and the
 * attempt, so a restart is a fresh one): its clock, its in-memory runtime in the Door at the
 * demo's own addresses, the panel registry its player drives, and the demo's controls' context.
 */
export function DemoProvider({
  script,
  rate,
  onRate,
  onRestart,
  children,
}: {
  script: Script;
  rate: Rate;
  onRate: (rate: Rate) => void;
  onRestart: () => void;
  children: ReactNode;
}) {
  const [registry] = useState<PanelRegistry>(() => new Map());
  const parts = useParts(script, registry, rate);
  const paths = useMemo(() => demoPaths(script), [script]);
  const demo = useMemo<Demo>(
    () => ({ script, player: parts?.player ?? null, rate, setRate: onRate, restart: onRestart }),
    [script, parts, rate, onRate, onRestart],
  );
  return (
    <DemoContext value={demo}>
      <ProvidedRuntime runtime={parts?.runtime ?? null} paths={paths}>
        <PanelRegistryProvider registry={registry}>{children}</PanelRegistryProvider>
      </ProvidedRuntime>
    </DemoContext>
  );
}

/**
 * The demo the page is playing.
 * @throws Outside a {@link DemoProvider}.
 */
export function useDemo(): Demo {
  const demo = useContext(DemoContext);
  if (demo === null) throw new Error("useDemo needs <DemoProvider> above it");
  return demo;
}
