import { Button } from "@yaklabs/ui/components/button";
import { Toggle } from "@yaklabs/ui/components/toggle";
import { ToggleGroup, ToggleGroupItem } from "@yaklabs/ui/components/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@yaklabs/ui/components/tooltip";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactElement } from "react";
import { useNavigate } from "react-router";
import type { Player, PlayerState } from "./player";
import { DEMO_BASE, useDemo } from "./provider";
import { scripts } from "./scripts";

// The player's state before its effect has started it: ready, nothing played.
const READY: PlayerState = { status: "idle", beat: 0, playedMs: 0 };

// A ghost control in the row: soft at rest, ink under the pointer, as a lane's title bar's.
const GHOST = "text-soft-ink hover:text-ink";

// How long the demo has played, "1:03".
function minutes(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// What the status says: ready, or where the playthrough stands and how long it has played.
function statusText(state: PlayerState, elapsed: number): string {
  switch (state.status) {
    case "idle":
      return "Ready";
    case "playing":
      return `Playing · ${minutes(elapsed)}`;
    case "paused":
      return `Paused · ${minutes(elapsed)}`;
    case "done":
      return `Done · ${minutes(elapsed)}`;
    default: {
      const unhandled: never = state.status;
      return unhandled;
    }
  }
}

// The player's state, re-rendering on each change, and every quarter second while it plays so
// the elapsed time moves.
function usePlayerState(player: Player | null): PlayerState {
  const subscribe = useCallback(
    (listener: () => void) => player?.subscribe(listener) ?? (() => {}),
    [player],
  );
  const snapshot = useCallback(() => player?.state() ?? READY, [player]);
  const state = useSyncExternalStore(subscribe, snapshot);
  const [, setTick] = useState(0);
  const playing = state.status === "playing";
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
  return state;
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

// The three scenarios, one pressed; each says what it shows in its pill. Choosing one opens it
// fresh, since the demo is keyed by its script.
function ScenarioPicker() {
  const { script } = useDemo();
  const navigate = useNavigate();
  return (
    <ToggleGroup
      aria-label="Scenario"
      size="sm"
      spacing={0.5}
      value={[script.id]}
      onValueChange={(values: unknown[]) => {
        const [chosen] = values; // → the scenario pressed, or none when its own was pressed again
        if (typeof chosen !== "string" || chosen === script.id) return;
        void navigate(`${DEMO_BASE}?${new URLSearchParams({ script: chosen }).toString()}`);
      }}
      className="rounded-[var(--radius)] border border-hairline p-0.5"
    >
      {scripts.map((each) => (
        <Named
          key={each.id}
          label={each.shows}
          control={
            <ToggleGroupItem
              value={each.id}
              className={`h-6 rounded-[3px] px-2.5 text-xs ${GHOST}`}
            >
              {each.label}
            </ToggleGroupItem>
          }
        />
      ))}
    </ToggleGroup>
  );
}

// Play, or Pause while playing; nothing to press once the playthrough is done.
function PlayButton({ player, state }: { player: Player | null; state: PlayerState }) {
  const playing = state.status === "playing";
  const label = playing ? "Pause" : "Play";
  return (
    <Named
      label={label}
      control={
        <Button
          variant="ghost"
          size="icon-sm"
          className={GHOST}
          aria-label={label}
          disabled={player === null || state.status === "done"}
          onClick={() => {
            if (playing) player?.pause();
            else player?.play();
          }}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
      }
    />
  );
}

// Twice the speed while pressed; it outlives a restart and a change of scenario.
function RateToggle() {
  const { rate, setRate } = useDemo();
  return (
    <Named
      label="Fast forward, 2x"
      control={
        <Toggle
          size="sm"
          aria-label="Fast forward, 2x"
          pressed={rate === 2}
          onPressedChange={(pressed) => {
            setRate(pressed ? 2 : 1);
          }}
          className={`h-7 min-w-7 rounded-[var(--radius)] px-1.5 text-xs tabular-nums ${GHOST}`}
        >
          2×
        </Toggle>
      }
    />
  );
}

// Play, 2x, Restart, and where the playthrough stands.
function Transport() {
  const { player, restart } = useDemo();
  const state = usePlayerState(player);
  return (
    <div className="flex items-center gap-1">
      <PlayButton player={player} state={state} />
      <RateToggle />
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
        {statusText(state, player?.elapsed() ?? 0)}
      </output>
    </div>
  );
}

/**
 * The scripted demo's controls, one row under the title bar (two on a phone, the picker
 * scrolling below): what this is and that nothing leaves the page (ADR-096), the scenario
 * picker, and the transport. The thread below is the app's own, driven through its own controls.
 */
export function DemoControls() {
  return (
    <div
      role="toolbar"
      aria-label="Scripted demo"
      data-slot="demo-controls"
      className="grid h-10 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-hairline bg-paper px-3 max-md:h-auto max-md:grid-cols-[minmax(0,1fr)_auto] max-md:grid-rows-[40px_auto] max-md:gap-y-0 max-md:pb-1.5"
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 text-[11px] font-medium tracking-[0.1em] text-soft-ink uppercase">
          Scripted demo
        </span>
        <span className="truncate text-xs text-soft-ink max-lg:hidden">
          Nothing is sent or changed
        </span>
      </div>
      <div className="max-md:no-scrollbar max-md:col-span-full max-md:row-start-2 max-md:overflow-x-auto">
        <ScenarioPicker />
      </div>
      <div className="flex justify-end max-md:col-start-2 max-md:row-start-1">
        <Transport />
      </div>
    </div>
  );
}
