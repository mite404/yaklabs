import { useRef, type PointerEvent } from "react";

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

// Whether a wheel landed on an open lane, which scrolls itself up and down, rather than on the
// ground. A collapsed lane's strip has nothing to scroll, so a wheel there pans like the ground.
function onOpenLane(path: EventTarget[]): boolean {
  return path.some(
    (node) =>
      node instanceof HTMLElement &&
      node.tagName === "ARTICLE" &&
      node.dataset.collapsed !== "true",
  );
}

// Whether something between the pointer and the row scrolls sideways itself and has room to go
// `dx`'s way, as a wide log or table in a lane can: that swipe is its own, not the row's.
function scrollsSideways(path: EventTarget[], row: HTMLElement, dx: number): boolean {
  for (const node of path) {
    if (node === row) return false;
    if (!(node instanceof HTMLElement) || node.scrollWidth <= node.clientWidth) continue;
    const { overflowX } = getComputedStyle(node);
    if (overflowX !== "auto" && overflowX !== "scroll") continue;
    const room = dx < 0 ? node.scrollLeft : node.scrollWidth - node.clientWidth - node.scrollLeft;
    if (room > 0) return true;
  }
  return false;
}

// How far a wheel moves the row sideways, or null when the row should leave it be. A sideways
// swipe pans the row wherever it lands, lanes included; an up-and-down wheel pans it only over
// the ground and the strips, since an open lane scrolls its own thread.
function sidewaysOf(event: WheelEvent, row: HTMLElement): number | null {
  const path = event.composedPath(); // → the pointer's target out to the window
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    return scrollsSideways(path, row, event.deltaX) ? null : event.deltaX;
  }
  return onOpenLane(path) ? null : event.deltaY;
}

/**
 * Wheels and trackpad swipes over the row pan it (ADR-089). Listened for natively and not
 * passively, since a passive listener cannot keep the browser from handing a sideways swipe
 * over a lane to that lane's thread, which latches the whole gesture and goes nowhere.
 * @returns The function that stops listening.
 */
export function panByWheel(row: HTMLElement): () => void {
  const wheel = (event: WheelEvent) => {
    if (event.ctrlKey) return; // a pinch zooms the page
    const by = sidewaysOf(event, row); // → px to pan, or null
    if (by === null || by === 0) return;
    event.preventDefault();
    row.scrollLeft += by;
  };
  row.addEventListener("wheel", wheel, { passive: false });
  return () => {
    row.removeEventListener("wheel", wheel);
  };
}
