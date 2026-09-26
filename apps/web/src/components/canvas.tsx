import { Button } from "@yaklabs/ui/components/button";
import { GripHorizontal, X } from "lucide-react";
import {
  Fragment,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import {
  accepts,
  landingIndex,
  readDrop,
  shiftFor,
  slotLeft,
  type Drop,
  type Slot,
} from "../canvas";
import { trackHintLine } from "./divider";

/** One lane on the canvas: what it is called and what it shows. */
export type LaneView = { id: string; title: string; node: ReactNode };

// A lane is a fixed column so the thread inside keeps one measure: this wide until its
// separator is dragged, and never narrower than this.
const LANE_WIDTH = "min(560px, 80vw)";
const LANE_MIN_PX = 320;
// The gap between lanes, which is the separator's width.
const GAP_PX = 16;
// How far a grip travels before its lane lifts, so a click stays a click.
const LIFT_PX = 6;
// How far one arrow key moves a separator, and a lane by its grip.
const KEY_STEPS: Partial<Record<string, number>> = { ArrowLeft: -24, ArrowRight: 24 };
const KEY_MOVES: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };

// A lane on its way somewhere (ADR-089): which, from which slot, the slot it would land in,
// and how far the pointer has carried it.
type Move = { id: string; from: number; to: number; dx: number };

// What a drag measured as it began, so the lift itself never moves the targets: every lane's
// slot in the row's own coordinates, the lanes' top and height there, and the pointer's x.
type Lift = { id: string; from: number; x: number; slots: Slot[]; top: number; height: number };

type GripHandlers = {
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
};

// The lane a separator resizes is the one before it in the row.
function laneBefore(separator: HTMLElement): HTMLElement | undefined {
  const lane = separator.previousElementSibling;
  return lane instanceof HTMLElement ? lane : undefined;
}

function clampWidth(px: number): number {
  return Math.max(LANE_MIN_PX, Math.round(px));
}

// Every lane's slot in the row, in the row's own coordinates (its scroll included), and where
// the pressed lane sits vertically, which is where every lane sits.
function measureLanes(row: HTMLElement, lane: HTMLElement): Pick<Lift, "slots" | "top" | "height"> {
  const rowBox = row.getBoundingClientRect();
  const laneBox = lane.getBoundingClientRect();
  const boxes = [...row.querySelectorAll(":scope > article")].map((el) =>
    el.getBoundingClientRect(),
  ); // → DOMRect[]
  return {
    slots: boxes.map((box) => ({
      left: box.left - rowBox.left + row.scrollLeft,
      width: box.width,
    })),
    top: laneBox.top - rowBox.top + row.scrollTop,
    height: laneBox.height,
  };
}

// A lane in hand: what the grip measured when it was pressed and, once the lane has travelled
// far enough to lift, where it is on its way to.
type Drag = { lift: Lift; move: Move | null };

// The drag as the pointer reaches `x`: unchanged until the lane has travelled enough to lift.
function dragTo(drag: Drag, x: number): Drag {
  const dx = x - drag.lift.x;
  if (drag.move === null && Math.abs(dx) < LIFT_PX) return drag;
  const { id, from, slots } = drag.lift;
  return { ...drag, move: { id, from, to: landingIndex(slots, from, dx), dx } };
}

// The skeleton's place: the slot the lifted lane would take, once that is not its own.
function skeletonFor(drag: Drag | null): CSSProperties | undefined {
  if (!drag?.move || drag.move.to === drag.move.from) return undefined;
  const { slots, top, height } = drag.lift;
  const { from, to } = drag.move;
  return { left: slotLeft(slots, from, to), top, width: slots[from].width, height };
}

// Reordering by a lane's grip: a drag lifts the lane once it has travelled a little, the lanes
// it passes step aside, and a skeleton of it marks the slot it would take. Arrow keys on the
// grip move the lane one slot either way.
function useReorder(onMove: (id: string, to: number) => void): {
  drag: Drag | null;
  skeleton: CSSProperties | undefined;
  gripFor: (id: string, index: number) => GripHandlers;
} {
  const [drag, setDrag] = useState<Drag | null>(null);

  const gripFor = (id: string, index: number): GripHandlers => ({
    onPointerDown: (event) => {
      const row = event.currentTarget.closest("section");
      const lane = event.currentTarget.closest("article");
      if (event.button !== 0 || !row || !lane) return;
      const lift = { id, from: index, x: event.clientX, ...measureLanes(row, lane) }; // → Lift
      setDrag({ lift, move: null });
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event) => {
      setDrag((current) => current && dragTo(current, event.clientX));
    },
    onPointerUp: () => {
      if (drag?.move && drag.move.to !== drag.move.from) onMove(drag.move.id, drag.move.to);
      setDrag(null);
    },
    onPointerCancel: () => {
      setDrag(null);
    },
    onKeyDown: (event) => {
      const step = KEY_MOVES[event.key];
      if (step === undefined) return;
      event.preventDefault();
      onMove(id, index + step);
    },
  });

  return { drag, skeleton: skeletonFor(drag), gripFor };
}

// How far lane `index` is displaced while a move is under way: the moving lane by the pointer,
// the lanes it passes by its room.
function displacement(drag: Drag | null, index: number): string {
  if (!drag?.move) return "";
  const { from, to, dx } = drag.move;
  const px = index === from ? dx : shiftFor(drag.lift.slots, from, to, index, GAP_PX);
  return `translateX(${px}px)`;
}

// The gap after a lane, which drags the lane's right edge (ADR-089). The hint line shows while
// the pointer is on it; pointer capture keeps the drag alive once the pointer outruns the gap.
function LaneSeparator({
  title,
  style,
  onResize,
}: {
  title: string;
  style: CSSProperties;
  onResize: (px: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  // Where the drag began: the pointer's x and the lane's width at that moment.
  const origin = useRef<{ x: number; width: number } | null>(null);

  function down(event: PointerEvent<HTMLDivElement>) {
    const lane = laneBefore(event.currentTarget);
    if (event.button !== 0 || !lane) return;
    event.preventDefault();
    origin.current = { x: event.clientX, width: lane.getBoundingClientRect().width };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function moveBy(event: PointerEvent<HTMLDivElement>) {
    trackHintLine(event);
    if (origin.current) {
      onResize(clampWidth(origin.current.width + event.clientX - origin.current.x));
    }
  }
  function up() {
    origin.current = null;
    setDragging(false);
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    const lane = laneBefore(event.currentTarget);
    const step = KEY_STEPS[event.key];
    if (!lane || step === undefined) return;
    event.preventDefault();
    onResize(clampWidth(lane.getBoundingClientRect().width + step));
  }

  /* oxlint-disable jsx-a11y/prefer-tag-over-role -- a separator that takes focus and a drag is a widget; an hr can do neither */
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${title}`}
      tabIndex={0}
      data-dragging={dragging || undefined}
      className="drag-hint lane-shift relative w-4 shrink-0 cursor-col-resize outline-none"
      style={style}
      onPointerDown={down}
      onPointerMove={moveBy}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    />
  );
  /* oxlint-enable jsx-a11y/prefer-tag-over-role */
}

// The strip above a lane: its grip at one end, its close at the other.
function LaneStrip({
  title,
  grip,
  onClose,
}: {
  title: string;
  grip: GripHandlers;
  onClose: () => void;
}) {
  return (
    <div className="flex h-8 items-center justify-between">
      <Button
        variant="ghost"
        size="icon-sm"
        className="cursor-grab touch-none rounded-[var(--radius)] text-soft-ink active:cursor-grabbing"
        aria-label={`Move ${title}`}
        {...grip}
      >
        <GripHorizontal />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-[var(--radius)]"
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
  grip,
  onClose,
}: {
  lane: LaneView;
  width: number | undefined;
  lifted: boolean;
  style: CSSProperties;
  grip: GripHandlers;
  onClose: (id: string) => void;
}) {
  return (
    <article
      className="lane-shift flex h-full shrink-0 flex-col"
      style={{ width: width ?? LANE_WIDTH, ...style }}
      data-lifted={lifted || undefined}
      aria-label={lane.title}
    >
      <LaneStrip
        title={lane.title}
        grip={grip}
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
function OpenSpace({ over, onBlank }: { over: boolean; onBlank: () => void }) {
  return (
    <div
      className={`flex h-full min-w-[320px] flex-1 flex-col items-center justify-center gap-4 rounded-[var(--radius-card)] border border-dashed p-6 text-center transition-colors ${
        over ? "border-olive bg-paper-deep/60" : "border-hairline"
      }`}
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

// The canvas as a drop target: whether a drag it takes is over it, and the handlers that say so.
function useDropTarget(onDrop: (drop: Drop) => void): {
  over: boolean;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
} {
  const [over, setOver] = useState(false);
  return {
    over,
    onDragOver: (event) => {
      if (!accepts(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setOver(true);
    },
    onDragLeave: () => {
      setOver(false);
    },
    onDrop: (event) => {
      event.preventDefault();
      setOver(false);
      const dropped = readDrop(event.dataTransfer); // → Drop | undefined
      if (dropped) onDrop(dropped);
    },
  };
}

/**
 * The compose canvas (ADR-089): a row of lanes that grows to the right, with open space at
 * the end that takes the next drop. A highlight from a thread starts a new thread there; a
 * card dragged by its header opens large. The gap after each lane drags the lane's width, and
 * a lane's grip drags it to another place in the row.
 */
export function Canvas({
  lanes,
  onDrop,
  onClose,
  onMove,
  onBlank,
}: {
  lanes: LaneView[];
  onDrop: (drop: Drop) => void;
  onClose: (id: string) => void;
  onMove: (id: string, to: number) => void;
  onBlank: () => void;
}) {
  const target = useDropTarget(onDrop);
  const reorder = useReorder(onMove);
  // Widths set by dragging, by lane id; a lane not listed is still at its default width.
  const [widths, setWidths] = useState<Record<string, number>>({});

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a drop target has no interactive role; the keyboard path is the Create blank thread button
    <section
      aria-label="Compose canvas"
      className="canvas relative flex h-full overflow-x-auto p-4"
      onDragOver={target.onDragOver}
      onDragLeave={target.onDragLeave}
      onDrop={target.onDrop}
      onWheel={panRow}
    >
      {lanes.map((lane, index) => (
        <Fragment key={lane.id}>
          <Lane
            lane={lane}
            width={widths[lane.id]}
            lifted={reorder.drag?.move?.id === lane.id}
            style={{ transform: displacement(reorder.drag, index) }}
            grip={reorder.gripFor(lane.id, index)}
            onClose={onClose}
          />
          <LaneSeparator
            title={lane.title}
            style={{ transform: displacement(reorder.drag, index) }}
            onResize={(px) => {
              setWidths((current) => ({ ...current, [lane.id]: px }));
            }}
          />
        </Fragment>
      ))}
      {reorder.skeleton && (
        <div className="lane-skeleton" data-skeleton style={reorder.skeleton} aria-hidden="true" />
      )}
      <OpenSpace over={target.over} onBlank={onBlank} />
    </section>
  );
}
