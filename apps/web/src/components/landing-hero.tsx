import { Link } from "react-router";
import type { ThemeChoice } from "../theme";
import { RUN, SHELL, STATS, VERDICTS } from "../verify-ui-tooling";
import { Seal } from "./design-tooling-seal";

// One line of the terminal: its words, and whether the run printed it in bold.
type Line = { text: string; bold?: boolean };

// The run as the terminal shows it, after the command line: the build lines, the notice in
// bold, then the captures.
const LINES: readonly Line[] = [
  ...RUN.lines.map((text) => ({ text })),
  { text: RUN.notice, bold: true },
  ...RUN.rest.map((text) => ({ text })),
];

// When the terminal's `n`th line arrives: 60ms after the one before, as a run prints them.
const delayOf = (n: number): string => `${n * 60}ms`;

/** The page's bar: the wordmark as the review app writes it, the way back, and the appearance. */
export function Bar({ theme }: { theme: ThemeChoice }) {
  const flip = () => {
    const now = document.documentElement.dataset.theme; // → "light" | "dark" | undefined
    theme.choose(now === "dark" ? "light" : "dark");
  };
  return (
    <div className="topbar">
      <Link to="/" className="brand">
        Yaklabs <span>/ Verify</span>
      </Link>
      <div className="land-bar-actions">
        <button type="button" className="btn btn-sm" onClick={flip}>
          Switch appearance
        </button>
        <Link to="/" className="btn btn-sm">
          Back to Kay
        </Link>
      </div>
    </div>
  );
}

// The run's terminal, as Ethan's screenshot showed it: the window's bar, the shell's prompt
// bar, the command, then every line the CLI printed, arriving one after another.
function Terminal() {
  return (
    <div className="land-terminal">
      <div className="land-term-bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>{SHELL.title}</span>
      </div>
      <div className="land-prompt" aria-hidden="true">
        <span className="land-seg-path">{SHELL.path}</span>
        <span className="land-seg-branch">{SHELL.branch}</span>
        <span className="land-seg-time">{SHELL.time}</span>
      </div>
      <pre className="land-term-body">
        <span className="land-line" style={{ animationDelay: delayOf(0) }}>
          <span className="program">{SHELL.program}</span> {SHELL.args}
        </span>
        <span className="land-line" style={{ animationDelay: delayOf(1) }} />
        {LINES.map((line, i) => (
          <span
            key={line.text === "" ? `blank-${i}` : line.text}
            className={`land-line${i === LINES.length - 1 ? " land-cursor" : ""}`}
            style={{ animationDelay: delayOf(i + 2) }}
          >
            {line.bold === true ? <b>{line.text}</b> : line.text}
          </span>
        ))}
      </pre>
    </div>
  );
}

/** The hero: Ethan's headline and question, the run's numbers, and the run itself beside them. */
export function Hero() {
  return (
    <header className="land-hero">
      <div>
        <p className="land-kicker">Design engineering / tooling</p>
        <h1 className="land-title">A design system agents can build with</h1>
        <p className="land-lede">
          Agents and plugins can create new screens faster than a small team can review them. How
          does a system verify the product stays coherent as it grows?
        </p>
        <ul className="land-proof">
          {STATS.map((stat) => (
            <li key={stat.label}>
              <b>{stat.value}</b>
              {stat.label}
            </li>
          ))}
        </ul>
      </div>
      <figure className="land-stage">
        <Terminal />
        <Seal size={132} className="land-stamp" />
      </figure>
    </header>
  );
}

/** The four verdicts rolling by on an ink band, with their exit codes and what to make of them. */
export function Ticker() {
  const words = VERDICTS.map((row) => (
    <span key={row.verdict}>
      {row.verdict} · exit {row.exit}
      <em>{row.meaning}</em>
    </span>
  ));
  return (
    <div className="land-ticker land-bleed" aria-label="The four verdicts a run can end with">
      <div className="land-ticker-track">
        {words}
        <span aria-hidden="true" className="contents">
          {words}
        </span>
      </div>
    </div>
  );
}
