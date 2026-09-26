// A highlight inside the thread is something to pick up (ADR-089), and the pointer says so
// before the browser's own drag does: an open hand over the highlight, a closed one from
// press to release. The thread carries the state as `data-grab`; the stylesheet draws the hands.

// The edges of a box, which is all the hit test reads of a DOMRect.
type Box = Pick<DOMRectReadOnly, "left" | "right" | "top" | "bottom">;

type Grab = "ready" | "held";

// A hand a pixel or two off a line box is still on it.
const SLACK_PX = 2;

/** Whether the point lies inside any of the boxes, with a little slack at the edges. */
export function pointInBoxes(boxes: Iterable<Box>, x: number, y: number): boolean {
  for (const box of boxes) {
    if (
      x >= box.left - SLACK_PX &&
      x <= box.right + SLACK_PX &&
      y >= box.top - SLACK_PX &&
      y <= box.bottom + SLACK_PX
    )
      return true;
  }
  return false;
}

// The line boxes of the highlight inside `within`; none when there is no highlight there.
function highlightBoxes(within: HTMLElement): Iterable<Box> {
  const selection = within.ownerDocument.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return [];
  const range = selection.getRangeAt(0);
  return within.contains(range.commonAncestorContainer) ? range.getClientRects() : [];
}

/**
 * Marks `thread` with `data-grab="ready"` while the pointer rests on a highlight inside it and
 * `"held"` from press to release, so the stylesheet can show the open and closed hands.
 * Returns the function that stops marking.
 */
export function markGrabbableHighlight(thread: HTMLElement): () => void {
  let held = false;
  let last = { x: -1, y: -1 };
  const mark = (state: Grab | undefined) => {
    if (state === undefined) delete thread.dataset.grab;
    else thread.dataset.grab = state;
  };
  const refresh = () => {
    if (!held) mark(pointInBoxes(highlightBoxes(thread), last.x, last.y) ? "ready" : undefined);
  };
  // A button held down while moving is a highlight being made, not one being picked up.
  const onMove = (event: PointerEvent) => {
    last = { x: event.clientX, y: event.clientY };
    if (event.buttons === 0) refresh();
  };
  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 || thread.dataset.grab !== "ready") return;
    held = true;
    mark("held");
  };
  const release = () => {
    held = false;
    refresh();
  };
  const document = thread.ownerDocument;
  thread.addEventListener("pointermove", onMove);
  thread.addEventListener("pointerdown", onDown);
  thread.addEventListener("dragend", release);
  document.addEventListener("pointerup", release);
  document.addEventListener("pointercancel", release);
  document.addEventListener("selectionchange", refresh);
  return () => {
    thread.removeEventListener("pointermove", onMove);
    thread.removeEventListener("pointerdown", onDown);
    thread.removeEventListener("dragend", release);
    document.removeEventListener("pointerup", release);
    document.removeEventListener("pointercancel", release);
    document.removeEventListener("selectionchange", refresh);
    mark();
  };
}
