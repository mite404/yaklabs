import { createContext, useContext } from "react";

/** A vertical span in a scroller's content coordinates (px from the top of its content). */
export type Span = { top: number; bottom: number };

/** Brings elements that just appeared or grew inside the thread into centered view. */
export type Reveal = (elements: HTMLElement[]) => void;

// Breathing room kept above a target that is too tall to center.
const EDGE_MARGIN_PX = 20;

// The union of several elements' spans, measured in the scroller's content coordinates.
function contentSpan(scroller: HTMLElement, elements: HTMLElement[]): Span {
  const origin = scroller.getBoundingClientRect().top + scroller.clientTop - scroller.scrollTop;
  const rects = elements.map((element) => element.getBoundingClientRect());
  return {
    top: Math.min(...rects.map((rect) => rect.top)) - origin,
    bottom: Math.max(...rects.map((rect) => rect.bottom)) - origin,
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * The scroll position that lands `target` vertically centered in the visible band of a
 * thread (ADR-022, ADR-037). A target taller than the band starts at the band's top, so it
 * is read from the beginning; the result is clamped to what the scroller can actually reach.
 * @param viewHeight The visible band: the scroller's height minus anything overlaying it.
 */
export function revealScrollTop({
  target,
  viewHeight,
  maxScrollTop,
  margin = EDGE_MARGIN_PX,
}: {
  target: Span;
  viewHeight: number;
  maxScrollTop: number;
  margin?: number;
}): number {
  const height = target.bottom - target.top;
  const top =
    height + 2 * margin <= viewHeight
      ? target.top - (viewHeight - height) / 2
      : target.top - margin;
  return Math.round(Math.min(Math.max(top, 0), Math.max(maxScrollTop, 0)));
}

/**
 * Scrolls `scroller` so the union of `elements` lands centered in its visible band.
 * The band excludes the recap overlay, whose height the thread publishes as `--recap-space`.
 */
export function revealInScroller(scroller: HTMLElement, elements: HTMLElement[]): void {
  if (elements.length === 0) return;
  const overlay = parseFloat(getComputedStyle(scroller).getPropertyValue("--recap-space")) || 0;
  const top = revealScrollTop({
    target: contentSpan(scroller, elements),
    viewHeight: scroller.clientHeight - overlay,
    maxScrollTop: scroller.scrollHeight - scroller.clientHeight,
  });
  scroller.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

const ThreadRevealContext = createContext<Reveal>(() => {});

/** Provided by the thread panel; outside a thread, revealing is a no-op. */
export const ThreadRevealProvider = ThreadRevealContext.Provider;

/**
 * For anything inside the thread that expands (cards, accordions, menus): call the returned
 * function with the newly shown elements right after they render, and the thread centers
 * them so nothing opens below the compose box (ADR-037).
 */
export function useThreadReveal(): Reveal {
  return useContext(ThreadRevealContext);
}
