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
  type PointerEvent,
  type ReactNode,
  type RefObject,
  type WheelEvent,
} from "react";
import { useLanding } from "./canvas-carry";
import { LaneSeparator } from "./lane-separator";
import { displacement, useReorder, type LaneHandlers } from "./lane-reorder";

/** One lane on the canvas: its name, the width it was left at (null: the default), its content. */
export type LaneView = { id: LaneId; title: string; width: number | null; node: ReactNode };

// A lane is a fixed column so the thread inside keeps one measure: this wide until its
// separator is dragged, and never wider than the pane less a strip of ground, so its close
// is always on screen and the ground beside it says there is more row to the right.
const LANE_WIDTH = "min(560px, calc(100% - 48px))";

// The ground: the row's own padding, the open space around its words, and the run of ground
// past it. A press there pans the row; a press on anything in a lane belongs to the lane.
function isGround(target: EventTarget | null, row: HTMLElement): boolean {
  return target === row || (target instanceof Element && target.matches("[data-ground]"));
}

// Panning by the ground (ADR-089): a press on the ground takes hold of the row, and the row
// follows the pointer until it lets go.
function usePan(): {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
} {
  // Where the pan began: the pointer's x and the row's scroll at that moment.
  const origin = useRef<{ x: number; scrollLeft: number } | null>(null);
  return {
    onPointerDown: (event) => {
      const row = event.currentTarget;
      if (event.button !== 0 || !isGround(event.target, row)) return;
      origin.current = { x: event.clientX, scrollLeft: row.scrollLeft };
      row.setPointerCapture(event.pointerId);
      document.documentElement.dataset.dragging = "ground";
    },
    onPointerMove: (event) => {
      if (origin.current) {
        event.currentTarget.scrollLeft =
          origin.current.scrollLeft - (event.clientX - origin.current.x);
      }
    },
    onPointerUp: () => {
      origin.current = null;
      delete document.documentElement.dataset.dragging;
    },
  };
}

// The strip above a lane: its close, at the far end.
function LaneStrip({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex h-8 items-center justify-end">
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-[var(--radius)] bg-transparent"
        aria-label={`Close ${title}`}
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

// The open space at the end of the row: the whole canvas when it is empty, a slimmer
// column once lanes exist, so there is always somewhere to drop the next thing, and it lights
// up when a carry would land there. The button is the catalog's own, the one a card's "Show my
// work" uses.
function OpenSpace({ lit, onBlank }: { lit: boolean; onBlank: () => void }) {
  return (
    <div
      data-ground=""
      data-lit={lit || undefined}
      className="flex h-full min-w-[320px] flex-1 flex-col items-center justify-center gap-4 rounded-[var(--radius-card)] border border-dashed border-hairline p-6 text-center transition-colors data-lit:border-olive data-lit:bg-paper-deep/60"
    >
      <p className="font-serif text-xl text-ink">
        Drag a text selection or card
        <br />
        to start a new thread with context
      </p>
      <button type="button" className="btn btn-sm" onClick={onBlank}>
        Create blank thread
      </button>
    </div>
  );
}

// Whether a wheel landed on a lane, which scrolls itself, rather than on the ground.
function onLane(event: WheelEvent<HTMLElement>): boolean {
  return event.nativeEvent
    .composedPath()
    .some((node) => node instanceof HTMLElement && node.tagName === "ARTICLE");
}

// A wheel over the ground pans the row, the way a trackpad's sideways swipe does.
function panRow(event: WheelEvent<HTMLElement>) {
  if (event.deltaX !== 0 || onLane(event)) return;
  event.currentTarget.scrollLeft += event.deltaY;
}

// What the lanes report: a close, a move to another slot, and a width kept.
type LaneActions = {
  onClose: (id: LaneId) => void;
  onMove: (id: LaneId, to: number) => void;
  onResize: (id: LaneId, px: number) => void;
};

// The lanes with the gap after each: a lane lifts by its title bar, a gap drags its width.
function LaneRow({ lanes, actions }: { lanes: LaneView[]; actions: LaneActions }) {
  const { onClose, onMove, onResize } = actions;
  const reorder = useReorder(onMove);
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

// Brings the focused lane into view and flashes it once each time the focus arrives on it, as
// soon as the lane is on the canvas.
function useFocusedLane(
  row: RefObject<HTMLElement | null>,
  focus: LaneId | null,
  present: boolean,
) {
  const shown = useRef<LaneId | null>(null);
  useEffect(() => {
    if (focus === null) shown.current = null;
    if (focus === null || !present || shown.current === focus) return;
    const lane = row.current?.querySelector(`[data-lane="${CSS.escape(focus)}"]`);
    if (!(lane instanceof HTMLElement)) return;
    shown.current = focus;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    lane.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: still ? "auto" : "smooth",
    });
    lane.dataset.flash = "";
    lane.addEventListener("animationend", () => delete lane.dataset.flash, { once: true });
  }, [row, focus, present]);
}

/**
 * The compose canvas (ADR-089): a row of lanes that grows to the right, with open space at
 * the end for the next thing. The gap after each lane drags the lane's width, a lane's title
 * bar drags it to another place in the row, and the ground drags to pan. The whole row takes a
 * carried card or highlight (ADR-091): while one is over it the pane shows it, and an ink
 * marker stands in the gap it would land in. The canvas keeps no lanes of its own: it reports
 * each change, and the caller's lanes come back changed.
 */
export function Canvas({
  lanes,
  focus,
  actions,
  onBlank,
  onCarry,
}: {
  lanes: LaneView[];
  /** The lane to bring into view and flash once, a focused child's. */
  focus: LaneId | null;
  actions: LaneActions;
  onBlank: () => void;
  onCarry: (carried: Carried, at: number) => void;
}) {
  const row = useRef<HTMLElement>(null);
  const pan = usePan();
  const landing = useLanding(row, onCarry);
  useFocusedLane(
    row,
    focus,
    lanes.some((lane) => lane.id === focus),
  );
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the ground pans by pointer and wheel; the keyboard reaches every lane and the Create blank thread button
    <section
      ref={row}
      aria-label="Compose canvas"
      data-drop={landing === null ? undefined : ""}
      className="canvas relative flex h-full overflow-x-auto p-4"
      onWheel={panRow}
      onPointerDown={pan.onPointerDown}
      onPointerMove={pan.onPointerMove}
      onPointerUp={pan.onPointerUp}
      onPointerCancel={pan.onPointerUp}
    >
      <LaneRow lanes={lanes} actions={actions} />
      {landing !== null && landing.marker !== null && (
        <div
          data-drop-marker=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-4 w-0.5 -translate-x-1/2 rounded-full bg-ink"
          style={{ left: landing.marker }}
        />
      )}
      <OpenSpace lit={landing !== null && landing.marker === null} onBlank={onBlank} />
      {/* The ground goes on for a pane past the open space: the canvas has no right edge. */}
      {lanes.length > 0 && <div data-ground="" aria-hidden="true" className="w-full shrink-0" />}
    </section>
  );
}
