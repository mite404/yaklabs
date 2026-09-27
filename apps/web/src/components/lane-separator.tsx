import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { trackHintLine } from "./divider";

// The widths the gap sets (ADR-117): never narrower than a readable measure for the thread
// inside, and never wider than the widest canvas a 2560px screen lays out.
const LANE_MIN_PX = 320;
const LANE_MAX_PX = 1800;
// What an arrow does on a separator: resize the lane before it by some px, or, with Shift,
// move that lane some slots.
type KeyAction = { kind: "resize"; by: number } | { kind: "move"; step: number };
const KEYS: Partial<Record<string, KeyAction>> = {
  ArrowLeft: { kind: "resize", by: -24 },
  ArrowRight: { kind: "resize", by: 24 },
  "Shift+ArrowLeft": { kind: "move", step: -1 },
  "Shift+ArrowRight": { kind: "move", step: 1 },
};

// The lane a separator resizes is the one before it in the row.
function laneBefore(separator: HTMLElement): HTMLElement | undefined {
  const lane = separator.previousElementSibling;
  return lane instanceof HTMLElement ? lane : undefined;
}

function clampWidth(px: number): number {
  return Math.min(LANE_MAX_PX, Math.max(LANE_MIN_PX, Math.round(px)));
}

// The gap's value, as ARIA's window splitter gives one: the lane's width, inside the range the
// gap sets, widened to hold a width the lane has from elsewhere (a default column in a pane
// narrower than the minimum).
function splitterValue(width: number) {
  return {
    "aria-valuenow": width,
    "aria-valuemin": Math.min(LANE_MIN_PX, width),
    "aria-valuemax": Math.max(LANE_MAX_PX, width),
    "aria-valuetext": `${width} pixels wide`,
  };
}

// The width of the lane before the gap, in whole px, followed as it changes; null until it is
// first measured.
function useLaneWidth(gap: RefObject<HTMLDivElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const lane = gap.current === null ? undefined : laneBefore(gap.current);
    if (lane === undefined) return () => {};
    const measure = () => {
      setWidth(Math.round(lane.getBoundingClientRect().width));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(lane);
    return () => {
      observer.disconnect();
    };
  }, [gap]);
  return width;
}

// Dragging the gap: the width follows the pointer, and is kept once the pointer lets go.
function useGapDrag(onResize: (px: number, kept: boolean) => void) {
  const [dragging, setDragging] = useState(false);
  // Where the drag began (the pointer's x and the lane's width then) and the width reached since.
  const origin = useRef<{ x: number; width: number; reached: number } | null>(null);
  const up = () => {
    const drag = origin.current;
    origin.current = null;
    setDragging(false);
    if (drag && drag.reached !== drag.width) onResize(drag.reached, true);
  };
  return {
    dragging,
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      const lane = laneBefore(event.currentTarget);
      if (event.button !== 0 || !lane) return;
      event.preventDefault();
      const width = lane.getBoundingClientRect().width;
      origin.current = { x: event.clientX, width, reached: width };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      trackHintLine(event);
      if (origin.current === null) return;
      const px = clampWidth(origin.current.width + event.clientX - origin.current.x);
      origin.current.reached = px;
      onResize(px, false);
    },
    onPointerUp: up,
    onPointerCancel: up,
  };
}

// The key as KEYS names it: "ArrowLeft", or "Shift+ArrowLeft" with Shift held.
function keyName(event: KeyboardEvent<HTMLDivElement>): string {
  return event.shiftKey ? `Shift+${event.key}` : event.key;
}

// Arrows resize the lane before the gap, kept at once; with Shift they move it a slot instead.
function keyOn(
  event: KeyboardEvent<HTMLDivElement>,
  onResize: (px: number, kept: boolean) => void,
  onMove: (step: number) => void,
): void {
  const action = KEYS[keyName(event)];
  const lane = laneBefore(event.currentTarget);
  if (action === undefined || lane === undefined) return;
  event.preventDefault();
  if (action.kind === "move") onMove(action.step);
  else onResize(clampWidth(lane.getBoundingClientRect().width + action.by), true);
}

/**
 * The gap after a lane, which drags the lane's right edge (ADR-089). The hint line shows while
 * the pointer is on it; pointer capture keeps the drag alive once the pointer outruns the gap.
 * The width follows the pointer and is kept when it lets go (`kept`); an arrow key keeps its
 * step at once, and with Shift moves the lane a slot instead. Focused, it says the lane's
 * width, as a window splitter does.
 */
export function LaneSeparator({
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
  const { dragging, ...handlers } = useGapDrag(onResize);
  const gap = useRef<HTMLDivElement>(null);
  const width = useLaneWidth(gap);
  /* oxlint-disable jsx-a11y/prefer-tag-over-role -- a separator that takes focus and a drag is a widget; an hr can do neither */
  return (
    <div
      ref={gap}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize or move ${title}`}
      {...(width === null ? {} : splitterValue(width))}
      tabIndex={0}
      data-dragging={dragging || undefined}
      className="drag-hint lane-shift relative w-4 shrink-0 cursor-col-resize outline-none"
      style={style}
      {...handlers}
      onKeyDown={(event) => {
        keyOn(event, onResize, onMove);
      }}
    />
  );
  /* oxlint-enable jsx-a11y/prefer-tag-over-role */
}
