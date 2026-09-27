import type { LaneId } from "@yaklabs/runtime";
import { Button } from "@yaklabs/ui/components/button";
import { X } from "lucide-react";
import {
  Fragment,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import { LaneSeparator } from "./lane-separator";
import { displacement, useReorder, type LaneHandlers } from "./lane-reorder";

/** One lane on the canvas: its name, the width it was left at (null: the default), its content. */
export type LaneView = { id: LaneId; title: string; width: number | null; node: ReactNode };

// A lane is a fixed column so the thread inside keeps one measure: this wide until its
// separator is dragged.
const LANE_WIDTH = "min(560px, 80vw)";

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
// column once lanes exist, so there is always somewhere to drop the next thing. The button is
// the catalog's own, the one a card's "Show my work" uses.
function OpenSpace({ onBlank }: { onBlank: () => void }) {
  return (
    <div
      data-ground=""
      className="flex h-full min-w-[320px] flex-1 flex-col items-center justify-center gap-4 rounded-[var(--radius-card)] border border-dashed border-hairline p-6 text-center"
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

/**
 * The compose canvas (ADR-089): a row of lanes that grows to the right, with open space at
 * the end for the next thing. The gap after each lane drags the lane's width, a lane's title
 * bar drags it to another place in the row, and the ground drags to pan. The canvas keeps no
 * lanes of its own: it reports each change, and the caller's lanes come back changed.
 */
export function Canvas({
  lanes,
  onClose,
  onMove,
  onResize,
  onBlank,
}: {
  lanes: LaneView[];
  onClose: (id: LaneId) => void;
  onMove: (id: LaneId, to: number) => void;
  onResize: (id: LaneId, px: number) => void;
  onBlank: () => void;
}) {
  const reorder = useReorder(onMove);
  const pan = usePan();
  // The width of the lane whose gap is being dragged, until the drag lets go and it is kept.
  const [resizing, setResizing] = useState<{ id: LaneId; px: number } | null>(null);

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the ground pans by pointer and wheel; the keyboard reaches every lane and the Create blank thread button
    <section
      aria-label="Compose canvas"
      className="canvas flex h-full overflow-x-auto p-4"
      onWheel={panRow}
      onPointerDown={pan.onPointerDown}
      onPointerMove={pan.onPointerMove}
      onPointerUp={pan.onPointerUp}
      onPointerCancel={pan.onPointerUp}
    >
      {lanes.map((lane, index) => (
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
      ))}
      <OpenSpace onBlank={onBlank} />
      {/* The ground goes on for a pane past the open space: the canvas has no right edge. */}
      {lanes.length > 0 && <div data-ground="" aria-hidden="true" className="w-full shrink-0" />}
    </section>
  );
}
