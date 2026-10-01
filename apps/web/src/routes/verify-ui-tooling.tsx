import { useEffect } from "react";
import { Band, Bento, Closing, Question } from "../components/landing-blocks";
import { Bar, Hero, Ticker } from "../components/landing-hero";
import "../verify-ui-tooling.css";

export function meta() {
  return [{ title: "Design tooling · Yaklabs / Verify" }];
}

// The page is light only (Ethan): it pins the light theme on the root while it is open and
// gives back whatever the visitor had on leaving, so the app keeps their choice. The root's
// own theme hook writes the attribute after this effect on a first load (a child's effect runs
// before its parent's) and again if the OS theme flips, so the pin watches the attribute and
// sets it back to light whenever something else writes it.
function useLightOnly(): void {
  useEffect(() => {
    const root = document.documentElement;
    const before = root.dataset.theme; // → "light" | "dark" | undefined
    const pin = () => {
      if (root.dataset.theme !== "light") root.dataset.theme = "light";
    };
    pin();
    const watch = new MutationObserver(pin);
    watch.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      watch.disconnect();
      if (before === undefined) delete root.dataset.theme;
      else root.dataset.theme = before;
    };
  }, []);
}

/**
 * The design tooling page (ADR-160): a landing page for `tools/verify-ui-drift` carrying
 * Ethan's copy over the tool's own evidence, in the light theme only. The run's terminal opens
 * it under the headline, then the verdicts roll by, the question, a bento of what a run gives,
 * the band with the second headline, and the seal. Public, outside the shell, and reached from
 * the welcome's seal.
 */
export default function VerifyUiToolingPage() {
  useLightOnly();
  return (
    <main className="tooling">
      <Bar />
      <Hero />
      <Ticker />
      <Question />
      <Bento />
      <Band />
      <Closing />
      <footer>
        <span>
          Internal use only · <code>tools/verify-ui-drift</code> · the README has the commands and
          the operating limits.
        </span>
        <span>Yaklabs / Verify</span>
      </footer>
    </main>
  );
}
