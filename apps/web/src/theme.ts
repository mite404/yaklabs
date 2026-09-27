import { useEffect, useState } from "react";

/** The two looks the tokens define (ADR-046). */
export type Theme = "light" | "dark";
/** What the visitor asked for: a look, or whatever the system prefers. */
export type ThemePreference = Theme | "system";

const KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

// Runs from the prerendered shell before React loads, so a dark visitor never sees a flash.
export const THEME_BOOT = `(()=>{try{var p=localStorage.getItem(${JSON.stringify(KEY)});var d=p==="dark"||(p!=="light"&&matchMedia(${JSON.stringify(DARK_QUERY)}).matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(KEY); // → "light" | "dark" | other | null
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function resolve(preference: ThemePreference): Theme {
  if (preference !== "system") return preference;
  return matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function apply(preference: ThemePreference): void {
  document.documentElement.dataset.theme = resolve(preference);
  try {
    if (preference === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, preference);
  } catch {
    // Private windows may refuse storage; the look still applies for this visit.
  }
}

/**
 * The visitor's theme preference and a setter that applies it to the root element and
 * remembers it. "system" follows the OS and updates when it changes.
 */
export function useTheme(): [ThemePreference, (next: ThemePreference) => void] {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  useEffect(() => {
    apply(preference);
    if (preference !== "system") return undefined;
    const media = matchMedia(DARK_QUERY);
    const follow = () => apply("system");
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [preference]);
  return [preference, setPreference];
}
