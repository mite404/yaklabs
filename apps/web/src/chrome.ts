import { useState } from "react";

/** The title bar's two looks (ADR-115): the flat green, or the oil painting under a green wash. */
export type ChromeStyle = "solid" | "painting";
/** The visitor's bar and how to change it, as the window hands it to the account menu. */
export type ChromeChoice = { style: ChromeStyle; choose: (next: ChromeStyle) => void };

const KEY = "kay.chrome";
const PARAM = "chrome";
const STYLES: readonly ChromeStyle[] = ["solid", "painting"];

const styleOf = (value: string | null): ChromeStyle | null =>
  STYLES.find((each) => each === value) ?? null;

function remember(style: ChromeStyle): void {
  try {
    localStorage.setItem(KEY, style);
  } catch {
    // The choice holds for this visit.
  }
}

// `?chrome=` is a one-time seed: it is kept as the visitor's choice and taken out of the address,
// so a remount or a reload keeps what they later pick from the menu. Then the stored choice;
// then the solid bar.
function readChrome(): ChromeStyle {
  const url = new URL(location.href);
  const asked = styleOf(url.searchParams.get(PARAM)); // → ChromeStyle | null
  if (asked !== null) {
    remember(asked);
    url.searchParams.delete(PARAM);
    history.replaceState(history.state, "", url);
    return asked;
  }
  try {
    return styleOf(localStorage.getItem(KEY)) ?? "solid";
  } catch {
    return "solid";
  }
}

/** The bar's look, read before the first paint so it never flips, and a setter that keeps it. */
export function useChrome(): ChromeChoice {
  const [style, setStyle] = useState(readChrome);
  return {
    style,
    choose: (next) => {
      setStyle(next);
      remember(next);
    },
  };
}
