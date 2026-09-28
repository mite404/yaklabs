import type { Carried } from "@yaklabs/catalog/carry";
import type { LaneId } from "@yaklabs/runtime";
import { Button } from "@yaklabs/ui/components/button";
import { X } from "lucide-react";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { useLanding, type Landing } from "./canvas-carry";
import { panRow, usePan } from "./canvas-pan";
import { LaneSeparator } from "./lane-separator";
import { Kay, Plate, SplashDrawing } from "./splash";
import { displacement, useReorder, type LaneHandlers } from "./lane-reorder";

/** One lane on the canvas: its name, the width it was left at (null: the default), its content. */
export type LaneView = { id: LaneId; title: string; width: number | null; node: ReactNode };

// A lane is a fixed column so the thread inside keeps one measure: this wide until its
// separator is dragged, and never wider than the pane less a strip of ground, so its close
// is always on screen and the ground beside it says there is more row to the right.
const LANE_WIDTH = "min(560px, calc(100% - 48px))";

// The strip above a lane: its close, at the far end.
function LaneStrip({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex h-8 items-center justify-end">
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-[var(--radius)]"
        aria-label={`Close ${title}`}
        data-lane-close=""
        onClick={onClose}
      >
        <X />
      </Button>
    </div>
  );
}

function Lane({
  lane,
  width,
  lifted,
  style,
  handlers,
  onClose,
}: {
  lane: LaneView;
  width: number | null;
  lifted: boolean;
  style: CSSProperties;
  handlers: LaneHandlers;
  onClose: (id: LaneId) => void;
}) {
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the pointer takes hold of the lane by its title bar; the keyboard moves it from the gap after it
    <article
      className="lane lane-shift flex h-full shrink-0 flex-col"
      style={{ width: width ?? LANE_WIDTH, ...style }}
      data-lane={lane.id}
      data-lifted={lifted || undefined}
      aria-label={lane.title}
      {...handlers}
    >
      <LaneStrip
        title={lane.title}
        onClose={() => {
          onClose(lane.id);
        }}
      />
      <div className="min-h-0 flex-1" style={{ ["--thread-height" as string]: "100%" }}>
        {lane.node}
      </div>
    </article>
  );
}

// The open space at the end of the row: the whole canvas when it is empty, with the splash
// behind its words, and a slimmer column once lanes exist, so there is always somewhere to drop
// the next thing. It lights up when a carry would land there.
function OpenSpace({
  lit,
  splash,
  onBlank,
}: {
  lit: boolean;
  splash: boolean;
  onBlank: () => void;
}) {
  return (
    <div
      data-ground=""
      data-lit={lit || undefined}
      className="open-space @container relative isolate flex h-full min-w-[320px] flex-1 flex-col items-center justify-center gap-4 rounded-[var(--radius-card)] border border-dashed border-hairline p-6 text-center transition-colors data-lit:border-olive"
    >
      {splash && <SplashDrawing />}
      <Plate splash={splash} onBlank={onBlank} />
      {splash && <Kay />}
    </div>
  );
}

// The full-height ink line in the gap a carry would land in; none at the end, where the open
// space lights up instead.
function DropMarker({ landing }: { landing: Landing | null }) {
  if (landing === null || landing.marker === null) return null;
  return (
    <div
      data-drop-marker=""
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-4 w-0.5 -translate-x-1/2 rounded-full bg-ink"
      style={{ left: landing.marker }}
    />
  );
}

// What the lanes report: a close, a move to another slot, and a width kept.
type LaneActions = {
  onClose: (id: LaneId) => void;
  onMove: (id: LaneId, to: number) => void;
  onResize: (id: LaneId, px: number) => void;
};

// The lanes with the gap after each: a lane lifts by its title bar, a gap drags its width.
function LaneRow({
  lanes,
  actions,
  reorderable,
}: {
  lanes: LaneView[];
  actions: LaneActions;
  reorderable: boolean;
}) {
  const { onClose, onMove, onResize } = actions;
  const reorder = useReorder(onMove, reorderable);
  // The width of the lane whose gap is being dragged, until the drag lets go and it is kept.
  const [resizing, setResizing] = useState<{ id: LaneId; px: number } | null>(null);
  return lanes.map((lane, index) => (
    <Fragment key={lane.id}>
      <Lane
        lane={lane}
        width={resizing?.id === lane.id ? resizing.px : lane.width}
        lifted={reorder.drag?.move?.id === lane.id}
        style={{ transform: displacement(reorder.drag, index) }}
        handlers={reorder.laneFor(lane.id, index)}
        onClose={onClose}
      />
      <LaneSeparator
        title={lane.title}
        style={{ transform: displacement(reorder.drag, index) }}
        onResize={(px, kept) => {
          setResizing(kept ? null : { id: lane.id, px });
          if (kept) onResize(lane.id, px);
        }}
        onMove={(step) => {
          onMove(lane.id, index + step);
        }}
      />
    </Fragment>
  ));
}

// A lane on the canvas by its id, or null while it is not there.
function laneIn(row: HTMLElement | null, id: LaneId): HTMLElement | null {
  const lane = row?.querySelector(`[data-lane="${CSS.escape(id)}"]`);
  return lane instanceof HTMLElement ? lane : null;
}

// Where the focus goes when the lane `id` closes with it: the next lane's close, else the one
// before's, else Create blank thread.
function focusAfter(row: HTMLElement, lanes: LaneView[], id: LaneId): Element | null {
  const at = lanes.findIndex((lane) => lane.id === id);
  const neighbour = lanes.slice(at + 1).at(0) ?? lanes.slice(0, at).at(-1);
  if (neighbour === undefined) return row.querySelector("[data-blank]");
  return laneIn(row, neighbour.id)?.querySelector("[data-lane-close]") ?? null;
}

// Before the lane `id` closes, hands on the focus it holds, which would otherwise fall back to
// the start of the page.
function handOnFocus(row: HTMLElement, lanes: LaneView[], id: LaneId): void {
  if (laneIn(row, id)?.contains(document.activeElement) !== true) return;
  const target = focusAfter(row, lanes, id);
  if (target instanceof HTMLElement) target.focus();
}

// Brings a lane into view and flashes it once.
function flash(lane: HTMLElement): void {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  lane.scrollIntoView({ block: "nearest", inline: "center", behavior: still ? "auto" : "smooth" });
  lane.dataset.flash = "";
  const settle = () => {
    delete lane.dataset.flash;
  };
  lane.addEventListener("animationend", settle, { once: true });
}

// Flashes the focused lane once for each visit, as soon as the lane is on the canvas: a lane
// that arrives after the visit did (reopened for it) flashes when it lands.
function useFocusedLane(
  row: RefObject<HTMLElement | null>,
  focus: LaneId | null,
  visit: string,
  lanes: LaneView[],
) {
  const shown = useRef<string | null>(null); // → the visit whose lane has flashed
  const target = lanes.some((lane) => lane.id === focus) ? focus : null;
  useEffect(() => {
    if (target === null) {
      shown.current = null;
      return;
    }
    const lane = shown.current === visit ? null : laneIn(row.current, target);
    if (lane === null) return;
    shown.current = visit;
    flash(lane);
  }, [row, target, visit]);
}

/**
 * The compose canvas (ADR-089): a row of lanes that grows to the right, with open space at
 * the end for the next thing. The gap after each lane drags the lane's width, a lane's title
 * bar drags it to another place in the row, and the ground drags to pan. The whole row takes a
 * carried card or highlight (ADR-091): while one is over it the pane shows it, and an ink
 * marker stands in the gap it would land in. On a phone the row is view-only (ADR-122): it
 * still scrolls sideways, but a lane's title bar no longer lifts it. The canvas keeps no lanes
 * of its own: it reports each change, and the caller's lanes come back changed. A lane that
 * closes with the focus in it hands the focus on to its neighbour.
 */
export function Canvas({
  lanes,
  focus,
  visit,
  actions,
  onBlank,
  onCarry,
  reorderable,
}: {
  lanes: LaneView[];
  /** The lane to bring into view and flash, a focused child's. */
  focus: LaneId | null;
  /** The visit to the focused lane's address: each new one flashes the lane again. */
  visit: string;
  actions: LaneActions;
  onBlank: () => void;
  onCarry: (carried: Carried, at: number) => void;
  /** Whether a lane's title bar takes hold of it; off makes the row view-only (ADR-122). */
  reorderable: boolean;
}) {
  const row = useRef<HTMLElement>(null);
  const pan = usePan();
  const landing = useLanding(row, onCarry);
  useFocusedLane(row, focus, visit, lanes);
  const onClose = (id: LaneId) => {
    if (row.current !== null) handOnFocus(row.current, lanes, id);
    actions.onClose(id);
  };
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the ground pans by pointer and wheel; the keyboard reaches every lane and the Create blank thread button
    <section
      ref={row}
      aria-label="Compose canvas"
      data-drop={landing === null ? undefined : ""}
      data-reorder={reorderable}
      className="canvas relative flex h-full overflow-x-auto p-4"
      onWheel={panRow}
      onPointerDown={pan.onPointerDown}
      onPointerMove={pan.onPointerMove}
      onPointerUp={pan.onPointerUp}
      onPointerCancel={pan.onPointerUp}
    >
      <LaneRow lanes={lanes} actions={{ ...actions, onClose }} reorderable={reorderable} />
      <DropMarker landing={landing} />
      <OpenSpace lit={landing?.marker === null} splash={lanes.length === 0} onBlank={onBlank} />
      {/* The ground goes on for a pane past the open space: the canvas has no right edge. */}
      {lanes.length > 0 && <div data-ground="" aria-hidden="true" className="w-full shrink-0" />}
    </section>
  );
}
