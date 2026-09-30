import { useCallback, useState } from "react";
import { Outlet, useNavigate, useOutletContext, useSearchParams } from "react-router";
import type { Rate } from "../demo/clock";
import { DemoControls } from "../demo/DemoControls";
import { DemoProvider, demoPaths } from "../demo/provider";
import { scriptFor } from "../demo/scripts";
import { Deck } from "../shell/deck";
import { ShellProvider, useShell } from "../shell/model";
import { Window } from "../shell/window";
import type { ThemeChoice } from "../theme";

export function meta() {
  return [{ title: "Weekly brief · Scripted demo" }];
}

// The route's own page, drawn only while no tab is on screen, as `_app`'s Page is.
function DemoPage() {
  const shell = useShell();
  return shell !== null && shell.active !== null ? null : <Outlet />;
}

/**
 * The scripted demo (ADR-137, ADR-139): the whole app shell as `/t/:threadId` composes it, on
 * an in-memory runtime that plays `?script=` (the first scenario by default) and a player that
 * performs its user beats through the thread's own controls. Nothing is kept or sent. A
 * restart or another scenario is a fresh playthrough on a fresh workspace; the 2x setting
 * outlives both.
 */
export default function DemoWeeklyBrief() {
  const theme = useOutletContext<ThemeChoice>();
  const [params] = useSearchParams();
  const script = scriptFor(params.get("script"));
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const [rate, setRate] = useState<Rate>(1);
  const restart = useCallback(() => {
    setAttempt((n) => n + 1);
    void navigate(demoPaths(script).hrefTo("/"));
  }, [navigate, script]);
  return (
    <DemoProvider
      key={`${script.id}-${attempt}`}
      script={script}
      rate={rate}
      onRate={setRate}
      onRestart={restart}
    >
      <ShellProvider>
        <Window theme={theme} banner={<DemoControls />}>
          <Deck />
          <DemoPage />
        </Window>
      </ShellProvider>
    </DemoProvider>
  );
}
