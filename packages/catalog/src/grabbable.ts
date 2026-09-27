import { armCarry } from "./carry";

// A highlight inside the thread is something to pick up (ADR-089), and the pointer says so:
// an open hand over a highlight that already exists, a closed one from press to release. While
// a highlight is being made the I-beam stays, as it has in every word processor: the hand is
// for a highlight the user comes back to, not the one under the button. The thread carries the
// state as `data-grab`; the stylesheet draws the hands. A press on the highlight carries its
// text (carry.ts), never the browser's own drag, which would drop the highlight as it starts.

// The edges of a box, which is all the hit test reads of a DOMRect.
type Box = Pick<DOMRectReadOnly, "left" | "right" | "top" | "bottom">;

type Grab = "ready" | "held";

// The pointer's last known place and the buttons down there, as `PointerEvent` reports them.
type Pointer = { x: number; y: number; buttons: number };

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

function pointerOf(event: PointerEvent): Pointer {
  return { x: event.clientX, y: event.clientY, buttons: event.buttons };
}

// The highlight inside `within`; undefined when there is none there.
function highlightIn(within: HTMLElement): Range | undefined {
  const selection = within.ownerDocument.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return undefined;
  const range = selection.getRangeAt(0);
  return within.contains(range.commonAncestorContainer) ? range : undefined;
}

// The line boxes of the highlight inside `within`; none when there is no highlight there.
function highlightBoxes(within: HTMLElement): Iterable<Box> {
  return highlightIn(within)?.getClientRects() ?? [];
}

// What rides the pointer for a highlight: its text on one line, in quotes.
function quoteChip(document: Document, text: string): HTMLElement {
  const chip = document.createElement("div");
  chip.className = "carry-quote";
  chip.textContent = `“${text.replaceAll(/\s+/g, " ").trim()}”`;
  return chip;
}

function refuseDrag(event: DragEvent): void {
  event.preventDefault();
}

/**
 * Marks `thread` with `data-grab="ready"` while the pointer rests on a highlight inside it and
 * `"held"` from press to release, so the stylesheet can show the open and closed hands, and
 * carries the highlight's text from a press on it. A click on the highlight clears it, as it
 * would have without the carry. Returns the function that stops all of it.
 */
export function markGrabbableHighlight(thread: HTMLElement): () => void {
  const document = thread.ownerDocument;
  let held = false;
  // Where the pointer last was and which buttons were down there. A button down is a highlight
  // being made, so the selection growing under it never shows the hand until it is released.
  let last: Pointer = { x: -1, y: -1, buttons: 0 };
  const mark = (state?: Grab) => {
    if (state === undefined) delete thread.dataset.grab;
    else thread.dataset.grab = state;
  };
  const refresh = () => {
    if (held || last.buttons !== 0) return;
    mark(pointInBoxes(highlightBoxes(thread), last.x, last.y) ? "ready" : undefined);
  };
  const onMove = (event: PointerEvent) => {
    last = pointerOf(event);
    refresh();
  };
  const onDown = (event: PointerEvent) => {
    last = pointerOf(event);
    const text = highlightIn(thread)?.toString();
    if (event.button !== 0 || thread.dataset.grab !== "ready" || text === undefined) return;
    held = true;
    mark("held");
    armCarry(event, { carried: { kind: "text", text }, picture: () => quoteChip(document, text) });
  };
  const onClick = (event: MouseEvent) => {
    if (pointInBoxes(highlightBoxes(thread), event.clientX, event.clientY))
      document.getSelection()?.removeAllRanges();
  };
  const release = () => {
    held = false;
    last = { ...last, buttons: 0 };
    refresh();
  };
  const listening = new AbortController();
  const options = { signal: listening.signal };
  thread.addEventListener("pointermove", onMove, options);
  thread.addEventListener("pointerdown", onDown, options);
  thread.addEventListener("click", onClick, options);
  thread.addEventListener("dragstart", refuseDrag, options);
  document.addEventListener("pointerup", release, options);
  document.addEventListener("pointercancel", release, options);
  document.addEventListener("selectionchange", refresh, options);
  return () => {
    listening.abort();
    mark();
  };
}
