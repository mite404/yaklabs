import { useSyncExternalStore } from "react";

/** The painting behind a new thread's welcome (ADR-136), with a switch to look through the others. */
export type SplashStyle = "landscape" | "abstract" | "vitruvian" | "bonsai";

// One row per look. A look with no assets yet is listed but cannot be chosen.
type SplashLook = { id: SplashStyle; label: string; available: boolean };

/** The looks the switch offers, in its order. Bonsai waits for its assets. */
export const SPLASH_LOOKS: readonly SplashLook[] = [
  { id: "landscape", label: "Landscape", available: true },
  { id: "abstract", label: "Abstract", available: true },
  { id: "vitruvian", label: "Vitruvian", available: true },
  { id: "bonsai", label: "Bonsai", available: false },
];

// Set once a welcome has been on screen, so the next visit knows the first is behind it.
const SEEN_KEY = "kay.splash.seen";
// Where the switch's choice was kept before the draw: read by nothing now, and cleared, so a
// look picked once no longer stands in for every draw after it.
const RETIRED_KEY = "kay.splash";
const PARAM = "splash";
// The first welcome a visitor ever sees, and the looks every visit after it draws from (Ethan:
// abstract the first time, then "a randomized choice ... either the landscape or the
// Vitruvian man").
const FIRST: SplashStyle = "abstract";
const RETURNING: readonly SplashStyle[] = ["landscape", "vitruvian"];

// The choice for this visit, held above any remount. Null until the first read decides it.
let current: SplashStyle | null = null;
const listeners = new Set<() => void>();

/** The look a string names, or null for anything else: unknown, or listed but not available yet. */
export const splashStyleOf = (value: string | null): SplashStyle | null =>
  SPLASH_LOOKS.find((look) => look.available && look.id === value)?.id ?? null;

/**
 * The look a visit opens with: the one the address asks for, else the abstract painting until a
 * welcome has been seen, then landscape or Vitruvian, drawn afresh each visit.
 * @param random A number in [0, 1), as `Math.random` gives.
 */
export function lookForVisit(
  asked: SplashStyle | null,
  seen: boolean,
  random: number,
): SplashStyle {
  if (asked !== null) return asked;
  if (!seen) return FIRST;
  return RETURNING[Math.min(RETURNING.length - 1, Math.floor(random * RETURNING.length))];
}

// The painting reaches the CSS as an attribute on <html>, the way the theme does: index.css
// draws the landscape and the abstract strokes off `data-splash`.
function apply(style: SplashStyle): void {
  document.documentElement.dataset.splash = style;
}

function wasSeen(): boolean {
  try {
    localStorage.removeItem(RETIRED_KEY);
    return localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    return false; // storage refused, as in a private window: every visit is a first
  }
}

/** Records that a welcome has been on screen, so later visits draw their painting. */
export function markSplashSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage refused: the next visit opens on the abstract painting again.
  }
}

// A `?splash=` in the address, which a screenshot run passes, so the same page can be shot in
// each look. It holds for the visit, as a choice from the switch does.
function fromAddress(): SplashStyle | null {
  try {
    return splashStyleOf(new URL(location.href).searchParams.get(PARAM));
  } catch {
    return null;
  }
}

function decide(): SplashStyle {
  return lookForVisit(fromAddress(), wasSeen(), Math.random());
}

// Decided on the first read, which is before the welcome's first paint, so the picture never
// flips from one look to another.
function snapshot(): SplashStyle {
  if (current === null) {
    current = decide();
    apply(current);
  }
  return current;
}

// Read as the module loads rather than at the first welcome: the app drops a `?splash=` from the
// address as it lands on a thread, before any welcome has been drawn. The prerender has no
// document to mark.
if (typeof document !== "undefined") snapshot();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// For this visit only: kept, the choice would stand in for every draw after it.
function choose(next: SplashStyle): void {
  if (splashStyleOf(next) === null || next === current) return;
  current = next;
  apply(next);
  for (const listener of listeners) listener();
}

/**
 * The welcome's painting and how to change it for this visit. Every caller reads the one store,
 * so the welcome and its switch agree with no prop between them. A look that is not available is
 * never chosen.
 */
export function useSplash(): { style: SplashStyle; choose: (next: SplashStyle) => void } {
  const style = useSyncExternalStore(subscribe, snapshot, () => FIRST); // → SplashStyle
  return { style, choose };
}
