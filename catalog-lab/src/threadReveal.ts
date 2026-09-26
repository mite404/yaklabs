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
    height <= band
      ? target.top - view.insetTop - (band - height) / 2
      : target.top - view.insetTop;
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

/**
 * Enforces ADR-038 for every component in the thread, without each one opting in: when a turn
 * grows right after the user clicked or pressed a key inside it (a table, "Show my work", a
 * longer description), the card that grew is nudged clear of the compose box.
 * Growth nobody asked for (charts sizing, fonts loading) keeps a thread that was at its end
 * at its end, so the last card rests exactly where the gap says, not a few pixels short.
 * @returns A cleanup function that stops watching.
 */
export function keepExpansionsInView(scroller: HTMLElement): () => void {
  let interaction: { target: HTMLElement; at: number } | undefined;
  const heights = new WeakMap<Element, number>();
  const atEnd = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 2;
  let pinned = atEnd();

  const remember = (event: Event) => {
    if (event.target instanceof HTMLElement)
      interaction = { target: event.target, at: performance.now() };
  };
  const track = () => {
    pinned = atEnd();
  };

  const resized = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const turn = entry.target as HTMLElement;
      const before = heights.get(turn);
      const after = entry.borderBoxSize[0]?.blockSize ?? turn.offsetHeight;
      heights.set(turn, after);
      if (before === undefined || after <= before) continue;
      const asked =
        interaction !== undefined &&
        performance.now() - interaction.at <= INTERACTION_WINDOW_MS &&
        turn.contains(interaction.target);
      if (asked) nudgeInScroller(scroller, [interaction!.target.closest<HTMLElement>(".card") ?? turn]);
      else if (pinned) scroller.scrollTop = scroller.scrollHeight;
    }
  });

  const watchTurns = () => {
    scroller.querySelectorAll(":scope > .turn").forEach((turn) => resized.observe(turn));
  };
  const added = new MutationObserver(watchTurns);

  watchTurns();
  added.observe(scroller, { childList: true });
  scroller.addEventListener("pointerdown", remember, true);
  scroller.addEventListener("keydown", remember, true);
  scroller.addEventListener("scroll", track, { passive: true });
  return () => {
    scroller.removeEventListener("scroll", track);
    resized.disconnect();
    added.disconnect();
    scroller.removeEventListener("pointerdown", remember, true);
    scroller.removeEventListener("keydown", remember, true);
  };
}
