import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { trackHintLine } from "./divider";

// A lane never gets narrower than this, so the thread inside keeps a readable measure.
const LANE_MIN_PX = 320;
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
  return Math.max(LANE_MIN_PX, Math.round(px));
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
 * step at once, and with Shift moves the lane a slot instead.
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
      {...handlers}
      onKeyDown={(event) => {
        keyOn(event, onResize, onMove);
      }}
    />
  );
  /* oxlint-enable jsx-a11y/prefer-tag-over-role */
}
