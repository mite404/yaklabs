import { useState } from "react";

/** The painting behind a new thread's welcome (ADR-136), behind a debug switch while Ethan chooses. */
export type SplashStyle = "landscape" | "abstract";
/** The visitor's painting and how to change it, as the window hands it to the switch. */
export type SplashChoice = { style: SplashStyle; choose: (next: SplashStyle) => void };

const KEY = "kay.splash";
const PARAM = "splash";
const STYLES: readonly SplashStyle[] = ["landscape", "abstract"];

// The choice for this visit, above any remount of the window, for when storage is refused.
let held: SplashStyle | null = null;

/** The look a string names, or null for anything else: a menu value or a stored one. */
export const splashStyleOf = (value: string | null | undefined): SplashStyle | null =>
  STYLES.find((each) => each === value) ?? null;

// The painting reaches the CSS as an attribute on <html>, the way the theme does, so the welcome
// and the switch need no prop between them: index.css draws the picture off `data-splash`.
function apply(style: SplashStyle): void {
  document.documentElement.dataset.splash = style;
}

function remember(style: SplashStyle): void {
  held = style;
  apply(style);
  try {
    localStorage.setItem(KEY, style);
  } catch {
    // Private windows may refuse storage; `held` keeps the choice for this visit.
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

// The visit's own choice first; then the address; then the stored choice; then the landscape.
// Applied before the first paint, so the picture never flips from one look to another.
function readSplash(): SplashStyle {
  if (held !== null) return held;
  const style = fromAddress() ?? stored() ?? "landscape";
  remember(style);
  return style;
}

/** The empty canvas's look, read before the first paint so it never flips, and a setter that keeps it. */
export function useSplash(): SplashChoice {
  const [style, setStyle] = useState(readSplash);
  return {
    style,
    choose: (next) => {
      remember(next);
      setStyle(next);
    },
  };
}
