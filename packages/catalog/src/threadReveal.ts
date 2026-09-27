/** A vertical span in a scroller's content coordinates (px from the top of its content). */
export type Span = { top: number; bottom: number };

/** The scroller's geometry: where it is, how tall it is, and what its padding keeps clear. */
export type Viewport = {
  scrollTop: number;
  height: number;
  /** Clear space at the top of the visible band (the thread's top padding). */
  insetTop: number;
  /** Clear space above the compose box: the thread's bottom padding plus any dock overlay. */
  insetBottom: number;
  maxScrollTop: number;
};

// How long after a click or key press a turn's growth still counts as that interaction's result.
const INTERACTION_WINDOW_MS = 1000;

// The user's latest click or key press inside the thread, and when it happened.
type Interaction = { target: HTMLElement; at: number };

function clamp(top: number, maxScrollTop: number): number {
  return Math.round(Math.min(Math.max(top, 0), Math.max(maxScrollTop, 0)));
}

// The union of several elements' spans, measured in the scroller's content coordinates.
function contentSpan(scroller: HTMLElement, elements: HTMLElement[]): Span {
  const origin = scroller.getBoundingClientRect().top + scroller.clientTop - scroller.scrollTop;
  const rects = elements.map((element) => element.getBoundingClientRect());
  return {
    top: Math.min(...rects.map((rect) => rect.top)) - origin,
    bottom: Math.max(...rects.map((rect) => rect.bottom)) - origin,
  };
}

// The scroller's padding is the single source of the resting gap, so a nudged card lands
// exactly where the last card of the thread rests: 20px above the compose box or dock.
function viewport(scroller: HTMLElement): Viewport {
  const style = getComputedStyle(scroller);
  return {
    scrollTop: scroller.scrollTop,
    height: scroller.clientHeight,
    insetTop: parseFloat(style.paddingTop) || 0,
    insetBottom: parseFloat(style.paddingBottom) || 0,
    maxScrollTop: scroller.scrollHeight - scroller.clientHeight,
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// What to reveal when `turn` grew: the card the user just clicked or keyed inside, when the
// growth came soon enough to be that interaction's result; undefined when nobody asked for it.
function askedToReveal(
  turn: HTMLElement,
  last: Interaction | undefined,
  now: number,
): HTMLElement | undefined {
  if (last === undefined || now - last.at > INTERACTION_WINDOW_MS) return undefined;
  if (!turn.contains(last.target)) return undefined;
  return last.target.closest<HTMLElement>(".card") ?? turn;
}

/**
 * The smallest scroll that keeps `target` clear of the compose box (ADR-038, ADR-071). A target
 * that is not clipped at the bottom stays put; a clipped one rises until its bottom edge rests
 * `insetBottom` above the compose box (or the card docked over it), like the last card in the
 * thread, even when that takes its top out of view: seeing the bottom edge is how the user
 * knows the whole card has been shown. Since it only reveals what is below, the thread never
 * scrolls up, which would move away from the click.
 */
export function nudgeScrollTop(target: Span, view: Viewport): number {
  const bandBottom = view.scrollTop + view.height - view.insetBottom;
  if (target.bottom <= bandBottom) return view.scrollTop;
  return clamp(target.bottom - view.height + view.insetBottom, view.maxScrollTop);
}

/**
 * The scroll that lands `target` vertically centered in the visible band, for jumps to a turn
 * (ADR-022): the eye goes to the middle. A target taller than the band starts at its top.
 */
export function centerScrollTop(target: Span, view: Viewport): number {
  const band = view.height - view.insetTop - view.insetBottom;
  const height = target.bottom - target.top;
  const top =
    height <= band ? target.top - view.insetTop - (band - height) / 2 : target.top - view.insetTop;
  return clamp(top, view.maxScrollTop);
}

/** Scrolls `scroller` by the smallest amount that keeps `elements` clear of the compose box. */
export function nudgeInScroller(scroller: HTMLElement, elements: HTMLElement[]): void {
  if (elements.length === 0) return;
  const view = viewport(scroller);
  const top = nudgeScrollTop(contentSpan(scroller, elements), view);
  if (top !== view.scrollTop)
    scroller.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/** Scrolls `scroller` so `element` lands centered in the visible band. */
export function centerInScroller(scroller: HTMLElement, element: HTMLElement): void {
  const top = centerScrollTop(contentSpan(scroller, [element]), viewport(scroller));
  scroller.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/** Where a thread's scroll stands: `reach` is the furthest `scrollTop` it can scroll to. */
export type ScrollStand = { reach: number; scrollTop: number };

/**
 * Whether a thread follows its end after a resize moved that end `moved` px further away (turns
 * growing, the view getting shorter): whether it rested at its end before the move. With scroll
 * anchoring off (thread.css), a resize moves the end but not the scroll, short of clamping it
 * to a nearer end, so the gap before was the gap now less `moved`. A reader who scrolled up,
 * even in the frame a streaming reply grew, left a gap the resize does not account for.
 */
export function restedAtEnd(now: ScrollStand, moved: number): boolean {
  return now.reach - now.scrollTop - moved < 2;
}

function standOf(scroller: HTMLElement): ScrollStand {
  return { reach: scroller.scrollHeight - scroller.clientHeight, scrollTop: scroller.scrollTop };
}

// What a batch of resizes did to the thread: how far it moved the end away from the scroll
// (turns growing, the view getting shorter) and which turns grew. Records each box's new height;
// a box's first measure moves nothing.
function measureResizes(
  scroller: HTMLElement,
  entries: ResizeObserverEntry[],
  heights: WeakMap<Element, number>,
): { moved: number; grown: HTMLElement[] } {
  let moved = 0;
  const grown: HTMLElement[] = [];
  for (const entry of entries) {
    const box = entry.target; // → Element; the thread itself or one of its `.turn`s
    if (!(box instanceof HTMLElement)) continue;
    const before = heights.get(box);
    const after = entry.borderBoxSize[0]?.blockSize ?? box.offsetHeight;
    heights.set(box, after);
    if (before === undefined) continue;
    if (box === scroller) moved += Math.max(before - after, 0);
    else if (after > before) {
      moved += after - before;
      grown.push(box);
    }
  }
  return { moved, grown };
}

/**
 * Enforces ADR-038 for every component in the thread, without each one opting in: when a turn
 * grows right after the user clicked or pressed a key inside it (a table, "Show my work", a
 * longer description), the card that grew is nudged clear of the compose box.
 * Growth nobody asked for (charts sizing, fonts loading, a reply streaming in) keeps a thread
 * that was at its end at its end, so the last card rests exactly where the gap says, not a few
 * pixels short; so does the view getting shorter as the compose box grows (ADR-103).
 * @returns A cleanup function that stops watching.
 */
export function keepExpansionsInView(scroller: HTMLElement): () => void {
  let interaction: Interaction | undefined;
  const heights = new WeakMap<Element, number>();

  const remember = (event: Event) => {
    if (event.target instanceof HTMLElement)
      interaction = { target: event.target, at: performance.now() };
  };

  const resized = new ResizeObserver((entries) => {
    const { moved, grown } = measureResizes(scroller, entries, heights); // → px, HTMLElement[]
    const now = performance.now();
    const asked = grown
      .map((turn) => askedToReveal(turn, interaction, now)) // → (HTMLElement | undefined)[]
      .filter((card) => card !== undefined); // → HTMLElement[]
    if (asked.length > 0) nudgeInScroller(scroller, asked);
    else if (moved > 0 && restedAtEnd(standOf(scroller), moved))
      scroller.scrollTop = scroller.scrollHeight;
  });

  const watchTurns = () => {
    scroller.querySelectorAll(":scope > .turn").forEach((turn) => {
      resized.observe(turn);
    });
  };
  const added = new MutationObserver(watchTurns);

  resized.observe(scroller, { box: "border-box" });
  watchTurns();
  added.observe(scroller, { childList: true });
  scroller.addEventListener("pointerdown", remember, true);
  scroller.addEventListener("keydown", remember, true);
  return () => {
    resized.disconnect();
    added.disconnect();
    scroller.removeEventListener("pointerdown", remember, true);
    scroller.removeEventListener("keydown", remember, true);
  };
}
