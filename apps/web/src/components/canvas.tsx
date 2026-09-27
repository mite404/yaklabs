import type { LaneId } from "@yaklabs/runtime";
import { Button } from "@yaklabs/ui/components/button";
import { X } from "lucide-react";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import { landingIndex, shiftFor, slotLeft, type Slot } from "../canvas";
import { trackHintLine } from "./divider";

/** One lane on the canvas: its name, the width it was left at (null: the default), its content. */
export type LaneView = { id: LaneId; title: string; width: number | null; node: ReactNode };

// A lane is a fixed column so the thread inside keeps one measure: this wide until its
// separator is dragged, and never narrower than this.
const LANE_WIDTH = "min(560px, 80vw)";
const LANE_MIN_PX = 320;
// The gap between lanes, which is the separator's width.
const GAP_PX = 16;
// How far a grip travels before its lane lifts, so a click stays a click.
const LIFT_PX = 6;
// How far one arrow key moves a separator; with Shift, how many slots it moves the lane.
const KEY_STEPS: Partial<Record<string, number>> = { ArrowLeft: -24, ArrowRight: 24 };
const KEY_MOVES: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };

// A lane on its way somewhere (ADR-089): which, from which slot, the slot it would land in,
// and how far the pointer has carried it.
type Move = { id: LaneId; from: number; to: number; dx: number; dy: number };

// What a drag measured as it began, so the lift itself never moves the targets: every lane's
// slot along the row, the pointer's place, and the lane's box on screen. The lane itself is
// kept for the copy that floats under the pointer.
type Lift = {
  id: LaneId;
  from: number;
  x: number;
  y: number;
  slots: Slot[];
  box: DOMRect;
  lane: HTMLElement;
};

// A lane in hand: what was measured when its grip was pressed and, once the lane has travelled
// far enough to lift, where it is on its way to.
type Drag = { lift: Lift; move: Move | null };

type LaneHandlers = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
};

// What takes hold of a lane: the title bar of what it shows, the same bar that drags a card
// out of a thread. The title itself is for renaming, and any button in the bar keeps its job.
const GRIP = ".thread-header, .card-heading";
const NOT_GRIP = "h2, .card-heading-text, input, button";

function isGrip(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest(GRIP) !== null && target.closest(NOT_GRIP) === null
  );
}

// The ground: the row's own padding, the open space around its words, and the run of ground
// past it. A press there pans the row; a press on anything in a lane belongs to the lane.
function isGround(target: EventTarget | null, row: HTMLElement): boolean {
  return target === row || (target instanceof Element && target.matches("[data-ground]"));
}

// The lane a separator resizes is the one before it in the row.
function laneBefore(separator: HTMLElement): HTMLElement | undefined {
  const lane = separator.previousElementSibling;
  return lane instanceof HTMLElement ? lane : undefined;
}

function clampWidth(px: number): number {
  return Math.max(LANE_MIN_PX, Math.round(px));
}

// Every lane's slot along the row, in the row's own coordinates (its scroll included).
function measureSlots(row: HTMLElement): Slot[] {
  const rowBox = row.getBoundingClientRect();
  return [...row.querySelectorAll(":scope > article")].map((el) => {
    const box = el.getBoundingClientRect();
    return { left: box.left - rowBox.left + row.scrollLeft, width: box.width };
  });
}

// The drag as the pointer reaches (x, y): unchanged until the lane has travelled enough to lift.
function dragTo(drag: Drag, x: number, y: number): Drag {
  const dx = x - drag.lift.x;
  const dy = y - drag.lift.y;
  if (drag.move === null && Math.abs(dx) < LIFT_PX && Math.abs(dy) < LIFT_PX) return drag;
  const { id, from, slots } = drag.lift;
  return { ...drag, move: { id, from, to: landingIndex(slots, from, dx), dx, dy } };
}

// A snapshot's live parts: what was typed and how far each part had scrolled, which cloning
// the DOM leaves behind. `to` has to be in the document already for the scrolling to take.
function syncSnapshot(from: HTMLElement, to: HTMLElement): void {
  const sources = from.querySelectorAll("*");
  const targets = to.querySelectorAll("*");
  sources.forEach((source, i) => {
    const target = targets[i];
    if (source instanceof HTMLTextAreaElement && target instanceof HTMLTextAreaElement) {
      target.value = source.value;
    }
    if (source.scrollTop !== 0) target.scrollTop = source.scrollTop;
  });
}

// A copy of the lane, fixed to the screen where the lane was, to float under the pointer.
function floatingCopyOf(lift: Lift): HTMLElement | null {
  const clone = lift.lane.cloneNode(true);
  if (!(clone instanceof HTMLElement)) return null;
  delete clone.dataset.lifted;
  clone.dataset.ghost = "";
  clone.setAttribute("aria-hidden", "true");
  clone.classList.add("lane-ghost");
  clone.style.left = `${lift.box.left}px`;
  clone.style.top = `${lift.box.top}px`;
  clone.style.width = `${lift.box.width}px`;
  clone.style.height = `${lift.box.height}px`;
  return clone;
}

// The copy of the lane that floats under the pointer while the lane itself waits, dimmed, in
// the slot it would take. It appears when the lane lifts and moves by however far the pointer
// has gone since.
function useFloatingCopy(lift: Lift | null, move: Move | null): void {
  const copy = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const clone = lift && floatingCopyOf(lift);
    if (!clone) return () => {};
    document.body.append(clone);
    syncSnapshot(lift.lane, clone);
    document.documentElement.dataset.dragging = "lane";
    copy.current = clone;
    return () => {
      clone.remove();
      delete document.documentElement.dataset.dragging;
      copy.current = null;
    };
  }, [lift]);

  useEffect(() => {
    if (copy.current && move) {
      copy.current.style.transform = `translate(${move.dx}px, ${move.dy}px)`;
    }
  }, [move]);
}

// The lifted lane and its move, or nothing while the pointer is still within the dead zone.
function liftedOf(drag: Drag | null): [Lift | null, Move | null] {
  return drag?.move ? [drag.lift, drag.move] : [null, null];
}

// What a press on a lane measured, or nothing when it was not on a grip.
function liftAt(event: PointerEvent<HTMLElement>, id: LaneId, index: number): Lift | null {
  const row = event.currentTarget.closest("section");
  if (event.button !== 0 || !row || !isGrip(event.target)) return null;
  const lane = event.currentTarget;
  return {
    id,
    from: index,
    x: event.clientX,
    y: event.clientY,
    slots: measureSlots(row),
    box: lane.getBoundingClientRect(),
    lane,
  };
}

// Reordering by a lane's grip: past a small dead zone the lane lifts, a copy of it rides the
// pointer, the lane itself waits dimmed in the slot it would take and the lanes it passes step
// aside. Arrow keys on the grip move the lane one slot either way.
function useReorder(onMove: (id: LaneId, to: number) => void): {
  drag: Drag | null;
  laneFor: (id: LaneId, index: number) => LaneHandlers;
} {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [lift, move] = liftedOf(drag);
  useFloatingCopy(lift, move);

  const laneFor = (id: LaneId, index: number): LaneHandlers => ({
    onPointerDown: (event) => {
      const pressed = liftAt(event, id, index);
      if (!pressed) return;
      event.preventDefault();
      setDrag({ lift: pressed, move: null });
      pressed.lane.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event) => {
      const { clientX, clientY } = event;
      setDrag((current) => current && dragTo(current, clientX, clientY));
    },
    onPointerUp: () => {
      if (drag?.move && drag.move.to !== drag.move.from) onMove(drag.move.id, drag.move.to);
      setDrag(null);
    },
    onPointerCancel: () => {
      setDrag(null);
    },
  });

  return { drag, laneFor };
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

// How far lane `index` is displaced while a move is under way: the lifted lane to the slot it
// would take, the lanes it passes by its room.
function displacement(drag: Drag | null, index: number): string {
  if (!drag?.move) return "";
  const { slots } = drag.lift;
  const { from, to } = drag.move;
  const px =
    index === from
      ? slotLeft(slots, from, to) - slots[from].left
      : shiftFor(slots, from, to, index, GAP_PX);
  return `translateX(${px}px)`;
}

// The gap after a lane, which drags the lane's right edge (ADR-089). The hint line shows while
// the pointer is on it; pointer capture keeps the drag alive once the pointer outruns the gap.
// The width follows the pointer and is kept when it lets go; an arrow key keeps its step at once.
function LaneSeparator({
  title,
  style,
  onResize,
  onMove,
}: {
  title: string;
  style: CSSProperties;
  onResize: (px: number, kept: boolean) => void;
  onMove: (step: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  // Where the drag began (the pointer's x and the lane's width then) and the width reached since.
  const origin = useRef<{ x: number; width: number; reached: number } | null>(null);

  function down(event: PointerEvent<HTMLDivElement>) {
    const lane = laneBefore(event.currentTarget);
    if (event.button !== 0 || !lane) return;
    event.preventDefault();
    const width = lane.getBoundingClientRect().width;
    origin.current = { x: event.clientX, width, reached: width };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function moveBy(event: PointerEvent<HTMLDivElement>) {
    trackHintLine(event);
    if (origin.current) {
      const px = clampWidth(origin.current.width + event.clientX - origin.current.x);
      origin.current.reached = px;
      onResize(px, false);
    }
  }
  function up() {
    const drag = origin.current;
    origin.current = null;
    setDragging(false);
    if (drag && drag.reached !== drag.width) onResize(drag.reached, true);
  }
  // Arrows resize the lane before the gap; with Shift they move it a slot instead.
  function resizeByKey(event: KeyboardEvent<HTMLDivElement>) {
    const lane = laneBefore(event.currentTarget);
    const step = KEY_STEPS[event.key];
    if (!lane || step === undefined) return;
    event.preventDefault();
    onResize(clampWidth(lane.getBoundingClientRect().width + step), true);
  }
  function moveByKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = KEY_MOVES[event.key];
    if (step === undefined) return;
    event.preventDefault();
    onMove(step);
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (event.shiftKey) moveByKey(event);
    else resizeByKey(event);
  }

  /* oxlint-disable jsx-a11y/prefer-tag-over-role -- a separator that takes focus and a drag is a widget; an hr can do neither */
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize or move ${title}`}
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
