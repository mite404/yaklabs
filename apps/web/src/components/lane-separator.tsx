import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { trackHintLine } from "./divider";

// A lane never gets narrower than this, so the thread inside keeps a readable measure.
const LANE_MIN_PX = 320;
// How far one arrow key moves a separator; with Shift, how many slots it moves the lane.
const KEY_STEPS: Partial<Record<string, number>> = { ArrowLeft: -24, ArrowRight: 24 };
const KEY_MOVES: Partial<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };

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

// Arrows resize the lane before the gap, kept at once; with Shift they move it a slot instead.
function keyOn(
  event: KeyboardEvent<HTMLDivElement>,
  onResize: (px: number, kept: boolean) => void,
  onMove: (step: number) => void,
): void {
  const lane = laneBefore(event.currentTarget);
  const step = (event.shiftKey ? KEY_MOVES : KEY_STEPS)[event.key];
  if (!lane || step === undefined) return;
  event.preventDefault();
  if (event.shiftKey) onMove(step);
  else onResize(clampWidth(lane.getBoundingClientRect().width + step), true);
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
