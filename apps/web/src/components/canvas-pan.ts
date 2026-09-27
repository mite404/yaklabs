import { useRef, type PointerEvent, type WheelEvent } from "react";

// The ground: the row's own padding, the open space around its words, and the run of ground
// past it. A press there pans the row; a press on anything in a lane belongs to the lane.
function isGround(target: EventTarget | null, row: HTMLElement): boolean {
  return target === row || (target instanceof Element && target.matches("[data-ground]"));
}

/**
 * Panning by the ground (ADR-089): a press on the ground takes hold of the row, and the row
 * follows the pointer until it lets go.
 */
export function usePan(): {
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

// Whether a wheel landed on a lane, which scrolls itself, rather than on the ground.
function onLane(event: WheelEvent<HTMLElement>): boolean {
  return event.nativeEvent
    .composedPath()
    .some((node) => node instanceof HTMLElement && node.tagName === "ARTICLE");
}

/** A wheel over the ground pans the row, the way a trackpad's sideways swipe does. */
export function panRow(event: WheelEvent<HTMLElement>): void {
  if (event.deltaX !== 0 || onLane(event)) return;
  event.currentTarget.scrollLeft += event.deltaY;
}
