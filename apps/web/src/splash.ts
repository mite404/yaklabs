import { useSyncExternalStore } from "react";

/** The painting behind a new thread's welcome (ADR-136), behind a debug switch while Ethan chooses. */
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

const KEY = "kay.splash";
const PARAM = "splash";
const FALLBACK: SplashStyle = "abstract";

// The choice for this visit, held above any remount, for when storage is refused. Null until the
// first read decides it.
let current: SplashStyle | null = null;
const listeners = new Set<() => void>();

/** The look a string names, or null for anything else: unknown, or listed but not available yet. */
export const splashStyleOf = (value: string | null): SplashStyle | null =>
  SPLASH_LOOKS.find((look) => look.available && look.id === value)?.id ?? null;

// The painting reaches the CSS as an attribute on <html>, the way the theme does: index.css
// draws the landscape and the abstract strokes off `data-splash`.
function apply(style: SplashStyle): void {
  document.documentElement.dataset.splash = style;
}

function save(style: SplashStyle): void {
  try {
    localStorage.setItem(KEY, style);
  } catch {
    // Private windows may refuse storage; `current` keeps the choice for this visit.
  }
}

function stored(): SplashStyle | null {
  try {
    return splashStyleOf(localStorage.getItem(KEY)); // → SplashStyle | null
  } catch {
    return null;
  }
}

// A `?splash=` in the address, which a screenshot run passes, so the same page can be shot in
// each look; it is kept as the choice, as a `?chrome=` is.
function fromAddress(): SplashStyle | null {
  try {
    return splashStyleOf(new URL(location.href).searchParams.get(PARAM));
  } catch {
    return null;
  }
}

// The address first, then the stored choice, then the abstract painting: a stale or unknown value of
// either falls through to the next.
function decide(): SplashStyle {
  const asked = fromAddress();
  if (asked !== null) {
    save(asked);
    return asked;
  }
  return stored() ?? FALLBACK;
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

function choose(next: SplashStyle): void {
  if (splashStyleOf(next) === null || next === current) return;
  current = next;
  apply(next);
  save(next);
  for (const listener of listeners) listener();
}

/**
 * The welcome's painting and how to change it. Every caller reads the one store, so the welcome
 * and its switch agree with no prop between them. A look that is not available is never chosen.
 */
export function useSplash(): { style: SplashStyle; choose: (next: SplashStyle) => void } {
  const style = useSyncExternalStore(subscribe, snapshot, () => FALLBACK); // → SplashStyle
  return { style, choose };
}
