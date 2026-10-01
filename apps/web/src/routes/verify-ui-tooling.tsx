import { Fragment, type ReactNode } from "react";
import { Link, useOutletContext } from "react-router";
import { Bar, Figure, Hero, Stats } from "../components/tooling-parts";
import type { ThemeChoice } from "../theme";
import { PROBLEMS, STEPS, RUN, VERDICTS, MISSING, APPROVAL, ROLES } from "../verify-ui-tooling";
import "../verify-ui-tooling.css";

export function meta() {
  return [{ title: "Design tooling · Yaklabs / Verify" }];
}

// One row of a results table: what names it, then its cells in the headings’ order.
type Row = { key: string; cells: readonly ReactNode[] };

// A table of a run’s results as the review app lays one out: the headings, then each row’s
// cells under them.
function Table({ headings, rows }: { headings: readonly string[]; rows: readonly Row[] }) {
  return (
    <table className="tooling-table">
      <thead>
        <tr>
          {headings.map((heading) => (
            <th key={heading}>{heading}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, i) => (
              <td key={headings[i]}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Problem() {
  return (
    <section className="tooling-section" aria-labelledby="problem">
      <h2 id="problem">Two kinds of editors, one surface</h2>
      <p>
        A person nudges a corner radius. An agent restyles a button while fixing something else.
        Both diffs read fine in review, and both are invisible until someone sees the product beside
        last week’s. Drift is not a bug anyone wrote. It is the sum of small decisions nobody
        compared.
      </p>
      <div className="tooling-cards">
        {PROBLEMS.map((problem) => (
          <div key={problem.title} className="tooling-card">
            <h3>{problem.title}</h3>
            <p>{problem.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Run() {
  return (
    <section id="run" className="tooling-section" aria-labelledby="run-heading">
      <h2 id="run-heading">How a run works</h2>
      <p>
        One command from the repository root. The default run captures five foundation stories in
        both themes across three engines, thirty captures, and ends with a verdict, the report’s
        path and plain lines saying why and what to do next.
      </p>
      <ol className="tooling-steps">
        {STEPS.map((step) => (
          <li key={step.title}>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
      <pre className="tooling-terminal">
        <span className="prompt">{RUN.command}</span>
        {"\n\n"}
        {RUN.lines.join("\n")}
        {"\n"}
        <b>{RUN.notice}</b>
        {"\n"}
        {RUN.rest.join("\n")}
      </pre>
      <p>
        This run is on a Mac. The approved references were made on CI’s Debian image, and browsers
        draw text a little differently on each OS, so the tool says so before it captures anything,
        records the captures, and ends INCOMPLETE rather than PASS. The camera proof still runs, and
        the counts for each engine are printed.
      </p>
      <Table
        headings={["Verdict", "Exit", "Meaning", "Trust it?"]}
        rows={VERDICTS.map((row) => ({
          key: row.verdict,
          cells: [row.verdict, row.exit, row.meaning, row.trust],
        }))}
      />
    </section>
  );
}

function Pixels() {
  return (
    <section id="pixels" className="tooling-section" aria-labelledby="pixels-heading">
      <h2 id="pixels-heading">Pixels: locate, then judge</h2>
      <p>
        The results list says which capture changed and by how much. The wipe shows before and after
        on one coordinate plane, so a narrower baseline stays narrower and nothing is aligned away.
        The inspector enlarges the same region of both images at 4x with no smoothing. All three
        share one selected capture.
      </p>
      <Figure
        src="pixels-workbench.webp"
        width={2000}
        height={1551}
        alt="The Pixels workbench: a results list with Button / Default marked changed, a before and after wipe over the button’s four states, and a pixel inspector showing the baseline’s square corner beside the current rounder one."
      >
        Button / Default, changed by 3,776 pixels, 0.154% of the image. The button’s corner went
        from 4px to 12px. The difference view says where, and the inspector shows the two corners
        side by side at the same point.
      </Figure>
      <Table
        headings={["Component / state", "Engine", "Theme", "Pixels", "Axe violations"]}
        rows={MISSING.map((row) => ({
          key: `${row.story} ${row.engine} ${row.theme}`,
          cells: [
            <Fragment key="story">
              {row.story}
              <span className="path">packages/catalog/src/{row.file}</span>
            </Fragment>,
            row.engine,
            row.theme,
            <span key="pixels" className="tooling-chip">
              missing baseline
            </span>,
            "0",
          ],
        }))}
      />
      <p>
        A capture with no approved reference for this machine, engine and theme is listed as
        missing, never as passing. Changes and axe findings are still listed when a run is
        INCOMPLETE, so a verdict never hides them.
      </p>
    </section>
  );
}

function Proof() {
  return (
    <section className="tooling-section" aria-labelledby="proof-heading">
      <h2 id="proof-heading">The tool tests its own camera</h2>
      <p>
        A passing comparison earns trust only if a deliberate mistake makes it fail. Every run
        recaptures the real Button story unchanged, then with a wrong text colour, then with a wrong
        padding, in an isolated page. The unchanged pair must give zero changed pixels and both
        mutations must differ, in every engine, or the run is INCOMPLETE and nothing can be approved
        on it.
      </p>
      <Figure
        src="comparator-proof.webp"
        width={2000}
        height={963}
        alt="Comparator proof: a table of changed pixel counts for Chromium, Firefox and WebKit, and below it the unchanged control beside the colour and geometry mutation differences drawn in red."
      >
        Zero changed pixels on the untouched recapture, thousands on each mutation, in all three
        engines. Red marks the deliberately changed pixels; grayscale is unchanged context. The
        workbench uses green for component differences, and saved reports keep their original
        overlay colours.
      </Figure>
    </section>
  );
}

function Contrast() {
  return (
    <section className="tooling-section" aria-labelledby="contrast-heading">
      <h2 id="contrast-heading">Contrast is measured, never judged by eye</h2>
      <p>
        Kay’s theme is a small set of semantic tokens, two inks and two lines. The Accessibility tab
        measures every declared pair in both themes against Kay’s minimums: 4.5:1 for text, 3:1 for
        essential marks. The Apple, Microsoft and Material lenses read the same table against those
        platforms’ recommendations. They are review lenses. They do not rewrite the theme or certify
        compliance.
      </p>
      <Figure
        src="contrast-kay.webp"
        width={2000}
        height={979}
        alt="Contrast in context under the Kay lens: a table of foreground and background token pairs with their measured ratio, Kay’s minimum and the result, in light and dark appearance, every row meeting its minimum."
      >
        Sixteen declared pairs, light and dark. The lowest is the focus ring at 3.01:1 on the light
        paper, exactly where a 3:1 mark is allowed to sit, and that is a measurement, not an
        opinion.
      </Figure>
      <Figure
        src="contrast-material.webp"
        width={2000}
        height={420}
        alt="The same table under the Material lens, with Material’s note that it recommends 4.5:1 for small text and 3:1 for large text and relevant graphics."
      >
        The Material lens over the same pairs. Changing the lens changes the minimum a pair is read
        against, and nothing else.
      </Figure>
    </section>
  );
}

function Approval() {
  return (
    <section className="tooling-section" aria-labelledby="approval-heading">
      <h2 id="approval-heading">What approval means</h2>
      <p>
        Approval accepts one screenshot as the reference for one component state in one rendering
        environment. It does not fix code and it does not certify accessibility. Keyboard and screen
        reader checks still need a person. After inspecting a capture, the reviewer copies its
        command from the review app:
      </p>
      <pre className="tooling-code">
        {
          "pnpm verify-ui-drift approve --run RUN_ID --keys foundations-button--default.chromium.light --expect 1\npnpm verify-ui-drift run"
        }
      </pre>
      <ul className="tooling-list">
        {APPROVAL.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

function Why() {
  return (
    <section className="tooling-section" aria-labelledby="why-heading">
      <h2 id="why-heading">Where it lands</h2>
      <p>
        One tool, built on the production catalog with no second set of components, that touches
        each of the roles a design engineering team needs filled.
      </p>
      <div className="tooling-cards">
        {ROLES.map((entry) => (
          <div key={entry.role} className="tooling-card">
            <p className="eyebrow">{entry.role.toUpperCase()}</p>
            <p>{entry.body}</p>
          </div>
        ))}
      </div>
      <p className="tooling-close">
        I built it before anyone asked, because the first week of people and agents sharing a
        codebase is when drift starts. The decisions it encodes, that a missing reference is not a
        pass, that CI cannot approve, that evidence outlives the run, are the decisions a team needs
        made once, by someone, and then kept.
      </p>
    </section>
  );
}

/**
 * The design tooling page (ADR-160): what `tools/verify-ui-drift` is for, how a run works and
 * what it shows, told for a visitor who has not seen the tool, with the review app’s own
 * pictures. Public, outside the shell, and reached from the welcome’s seal.
 */
export default function VerifyUiToolingPage() {
  const theme = useOutletContext<ThemeChoice>();
  return (
    <main className="tooling">
      <Bar theme={theme} />
      <Hero />
      <Stats />
      <Problem />
      <Run />
      <Pixels />
      <Proof />
      <Contrast />
      <Approval />
      <Why />
      <footer>
        <span>
          Internal use only · <code>tools/verify-ui-drift</code> · the README has the commands and
          the operating limits.
        </span>
        <Link to="/">Back to Kay</Link>
      </footer>
    </main>
  );
}
