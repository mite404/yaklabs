import { Button } from "@yaklabs/ui/components/button";
import { Toggle } from "@yaklabs/ui/components/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@yaklabs/ui/components/tooltip";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useState, type ReactElement } from "react";
import type { PlayerStatus } from "../demo/player";
import { useShell } from "../shell/model";
import { useShow } from "./provider";
import type { Show, ShowState } from "./show";

// The show on screen and where it stands.
type On = { show: Show; state: ShowState };

// A ghost control in the row: soft at rest, ink under the pointer, as a lane's title bar's.
const GHOST = "text-soft-ink hover:text-ink";

// How long the demo has played, "1:03".
function minutes(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// What each status is called; the time played follows all but Ready.
const STATUS_WORDS: Record<PlayerStatus, string> = {
  idle: "Ready",
  playing: "Playing",
  paused: "Paused",
  done: "Done",
};

// What the status says: ready, or where the take stands and how long it has played.
function statusText(state: ShowState, elapsed: number): string {
  const word = STATUS_WORDS[state.status];
  return state.status === "idle" ? word : `${word} · ${minutes(elapsed)}`;
}

// A render every quarter second while the show plays, so the elapsed time moves.
function useTicking(playing: boolean): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = playing
      ? setInterval(() => {
          setTick((n) => n + 1);
        }, 250)
      : undefined;
    return () => {
      clearInterval(timer);
    };
  }, [playing]);
}

// A control that names itself in the ink pill below it (design pillars, rule 28).
function Named({ label, control }: { label: string; control: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={control} />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

// Plays the show again from its start, with a clear thread, and goes to its main thread, since
// the children it had are gone.
function useReplay(show: Show): () => void {
  const shell = useShell();
  return () => {
    show.restart();
    shell?.open(show.thread);
    show.play();
  };
}

// What the play button says it does: start or go on, hold, or, once the take is done, play the
// show again from its start.
function playLabel(status: PlayerStatus): string {
  if (status === "playing") return "Pause";
  return status === "done" ? "Play again" : "Play";
}

// Play, Pause while playing, and Play again once the take is done.
function PlayButton({ show, state }: On) {
  const replay = useReplay(show);
  const label = playLabel(state.status);
  return (
    <Named
      label={label}
      control={
        <Button
          variant="ghost"
          size="icon-sm"
          className={GHOST}
          aria-label={label}
          onClick={() => {
            if (state.status === "playing") show.pause();
            else if (state.status === "done") replay();
            else show.play();
          }}
        >
          {state.status === "playing" ? <Pause /> : <Play />}
        </Button>
      }
    />
  );
}

// Twice the speed while pressed; it outlives a restart.
function RateToggle({ show, state }: On) {
  return (
    <Named
      label="Fast forward, 2x"
      control={
        <Toggle
          size="sm"
          aria-label="Fast forward, 2x"
          pressed={state.rate === 2}
          onPressedChange={(pressed) => {
            show.setRate(pressed ? 2 : 1);
          }}
          className={`h-7 min-w-7 rounded-[var(--radius)] px-1.5 text-xs tabular-nums ${GHOST}`}
        >
          2×
        </Toggle>
      }
    />
  );
}

// Play, 2x, Restart, and where the take stands. Restart, at any point of the take, plays this
// show again from its start with a clear thread.
function Transport({ show, state }: On) {
  useTicking(state.status === "playing");
  const restart = useReplay(show);
  return (
    <div className="flex items-center gap-1">
      <PlayButton show={show} state={state} />
      <RateToggle show={show} state={state} />
      <Named
        label="Restart"
        control={
          <Button
            variant="ghost"
            size="icon-sm"
            className={GHOST}
            aria-label="Restart"
            onClick={restart}
          >
            <RotateCcw />
          </Button>
        }
      />
      {/* Not a live region: it would read the time out every second. */}
      <output
        aria-live="off"
        data-slot="demo-status"
        className="ml-2 min-w-24 text-xs text-soft-ink tabular-nums"
      >
        {statusText(state, show.elapsed())}
      </output>
    </div>
  );
}

// What this is, that nothing leaves the page (ADR-096), and the show's standing: what of it is
// shipped and what is proposed, so the bar says so before anyone asks.
function Standing({ show }: { show: Show }) {
  const { script } = show;
  return (
    <div className="flex min-w-0 flex-col justify-center leading-4">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 text-[11px] font-medium tracking-[0.1em] text-soft-ink uppercase">
          Scripted demo
        </span>
        <span className="truncate text-[11px] text-soft-ink max-lg:hidden">
          Nothing is sent or changed
        </span>
      </div>
      <p data-slot="demo-standing" className="truncate text-[11px] text-soft-ink max-md:hidden">
        {script.standing}
      </p>
    </div>
  );
}

/**
 * The controls of the show on screen, one row under the title bar (two on a phone): what this
 * is, that nothing leaves the page (ADR-096) and what of the show is shipped or proposed, then
 * Play, 2x, Restart and the time played. It draws nothing unless the thread on screen is a
 * show's main or one of its children, so it comes and goes with the Demo's threads. The thread
 * below is the app's own, driven through its own controls.
 */
export function ShowBar() {
  const shell = useShell();
  const on = useShow(shell?.active?.main ?? null);
  if (on === null) return null;
  return (
    <div
      role="toolbar"
      aria-label="Scripted demo"
      data-slot="demo-controls"
      className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-paper px-3"
    >
      <Standing show={on.show} />
      <Transport show={on.show} state={on.state} />
    </div>
  );
}
