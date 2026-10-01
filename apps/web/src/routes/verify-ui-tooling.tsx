import { useOutletContext } from "react-router";
import { Band, Bento, Claim, Closing, Roles } from "../components/landing-blocks";
import { Bar, Hero, Ticker } from "../components/landing-hero";
import type { ThemeChoice } from "../theme";
import "../verify-ui-tooling.css";

export function meta() {
  return [{ title: "Design tooling · Yaklabs / Verify" }];
}

/**
 * The design tooling page (ADR-160): a landing page for `tools/verify-ui-drift`, told for a
 * visitor who has not seen the tool. The run's own terminal opens it, then the verdicts roll
 * by, the claim, a bento of what a run gives, the contrast band, the four roles and the
 * closing word. Public, outside the shell, and reached from the welcome's seal.
 */
export default function VerifyUiToolingPage() {
  const theme = useOutletContext<ThemeChoice>();
  return (
    <main className="tooling">
      <Bar theme={theme} />
      <Hero />
      <Ticker />
      <Claim />
      <Bento />
      <Band />
      <Roles />
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
