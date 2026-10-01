import { Link } from "react-router";
import {
  APPROVAL,
  MISSING,
  PAIRS,
  PICTURES,
  PROBLEMS,
  PROOF,
  ROLES,
  STEPS,
} from "../verify-ui-tooling";
import { Seal } from "./design-tooling-seal";

// The lenses the Accessibility tab reads the contrast table through; Kay's is the one on.
const LENSES = ["Kay", "Apple", "Microsoft", "Material"] as const;

// The bars' scale: the highest ratio a declared pair reaches, so every bar fits its track.
const BAR_TOP = 16;

// A ratio's place along a bar's track, as a percentage of its width.
const along = (ratio: number): string => `${((ratio / BAR_TOP) * 100).toFixed(1)}%`;

/** The claim: why the check has to be a tool, and the three ways a change gets through a review. */
export function Claim() {
  return (
    <section id="claim" className="land-claim" aria-labelledby="claim-heading">
      <p className="land-kicker">01 / The problem</p>
      <div>
        <h2 id="claim-heading">Two kinds of editors, one surface.</h2>
        <p>
          A person nudges a corner radius. An agent restyles a button while fixing something else.
          Both diffs read fine in review. Drift is not a bug anyone wrote. It is the sum of small
          decisions nobody compared.
        </p>
        <div className="land-cascade">
          {PROBLEMS.map((problem) => (
            <div key={problem.title} className="land-note">
              <h3>{problem.title}</h3>
              <p>{problem.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// The biggest cell: the Pixels workbench, with its count on a chip and its story at the foot.
function PixelsCell() {
  return (
    <div className="land-cell land-cell-pixels" id="pixels">
      <img
        src={`${PICTURES}/pixels-workbench.webp`}
        width={2000}
        height={1551}
        alt="The Pixels workbench: a results list with Button / Default marked changed, a before and after wipe over the button's four states, and a pixel inspector showing the baseline's square corner beside the current rounder one."
        loading="lazy"
        decoding="async"
      />
      <span className="land-chip">3,776 changed pixels · 0.154%</span>
      <div className="land-cell-words">
        <h3>Locate, then judge</h3>
        <p>
          The list says which capture changed and by how much. The wipe shows before and after on
          one coordinate plane. The inspector enlarges the same corner of both at 4x, no smoothing.
          The corner went from 4px to 12px, and the difference view says where.
        </p>
      </div>
    </div>
  );
}

// The numeral cell: what CI may approve, and the rows a machine with no references shows.
function ZeroCell() {
  return (
    <div className="land-cell land-cell-zero">
      <p className="land-numeral">0</p>
      <h3>references CI can approve</h3>
      <p>
        A capture with no approved reference for this machine is listed as missing, never as
        passing. A person decides, and names the count expected.
      </p>
      <ul className="land-rows">
        {MISSING.slice(0, 3).map((row) => (
          <li key={`${row.story} ${row.engine} ${row.theme}`}>
            <span>{row.story}</span>
            <span>
              {row.engine} · {row.theme}
            </span>
            <span className="land-tag">missing baseline</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The proof cell: the comparator's counts for each engine.
function ProofCell() {
  return (
    <div className="land-cell land-cell-proof">
      <h3>The tool tests its own camera</h3>
      <p>
        An untouched Button recaptured must give zero changed pixels. A wrong colour and a wrong
        padding must both differ, in every engine, or nothing can be approved on the run.
      </p>
      <table>
        <thead>
          <tr>
            <th>engine</th>
            <th>control</th>
            <th>colour</th>
            <th>geometry</th>
          </tr>
        </thead>
        <tbody>
          {PROOF.map((row) => (
            <tr key={row.engine}>
              <td>{row.engine}</td>
              <td>
                <b>{row.control}</b>
              </td>
              <td>{row.color.toLocaleString("en-US")}</td>
              <td>{row.geometry.toLocaleString("en-US")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The ink cell: the one command that makes a reference, and what the CLI refuses.
function ApproveCell() {
  return (
    <div className="land-cell land-cell-ink">
      <h3>Approval is a command, not a click</h3>
      <pre>
        {
          "pnpm verify-ui-drift approve \\\n  --run RUN_ID \\\n  --keys foundations-button--default.chromium.light \\\n  --expect 1"
        }
      </pre>
      <p>{APPROVAL[2]}</p>
    </div>
  );
}

// The contrast cell: four measured pairs as flat bars, each with its minimum marked.
function ContrastCell() {
  return (
    <div className="land-cell land-cell-contrast">
      <h3>Contrast is measured</h3>
      <ul className="land-bars">
        {PAIRS.map((row) => (
          <li key={row.pair}>
            <div className="land-bar">
              <span>{row.pair}</span>
              <b>{row.ratio.toFixed(2)}:1</b>
            </div>
            <div className="land-bar-track">
              <div className="land-bar-fill" style={{ width: along(row.ratio) }} />
              <div className="land-bar-min" style={{ left: along(row.minimum) }} />
            </div>
          </li>
        ))}
      </ul>
      <p>The rule marks each pair’s minimum. The focus ring clears its 3:1 by a hundredth.</p>
    </div>
  );
}

// The steps cell: the five beats of a run.
function StepsCell() {
  return (
    <div className="land-cell land-cell-steps">
      <h3>One command, five beats</h3>
      <ol className="land-steps">
        {STEPS.map((step) => (
          <li key={step.title}>
            <span>
              <b>{step.title}</b>
            </span>
          </li>
        ))}
      </ol>
      <p>{STEPS[4].body}</p>
    </div>
  );
}

/** The bento: six cells of what a run gives, the picture the biggest. */
export function Bento() {
  return (
    <section className="land-bento" aria-label="What a run gives">
      <PixelsCell />
      <ZeroCell />
      <ProofCell />
      <ApproveCell />
      <ContrastCell />
      <StepsCell />
    </section>
  );
}

/** The band: the contrast table under its lenses, on the window chrome's green. */
export function Band() {
  return (
    <section className="land-band land-bleed" aria-labelledby="band-heading">
      <div className="land-band-inner">
        <div>
          <p className="land-kicker">02 / Accessibility</p>
          <h2 id="band-heading">Measured, never judged by eye.</h2>
          <p>
            Kay’s theme is two inks and two lines. Every declared pair is measured in both themes
            against Kay’s minimums: 4.5:1 for text, 3:1 for essential marks. The other lenses read
            the same table against a platform’s recommendation. They are review lenses, not a new
            palette.
          </p>
          <ul className="land-lenses">
            {LENSES.map((lens) => (
              <li key={lens} data-on={lens === "Kay" ? "" : undefined}>
                {lens}
              </li>
            ))}
          </ul>
        </div>
        <figure className="land-shots">
          <img
            src={`${PICTURES}/contrast-kay.webp`}
            width={2000}
            height={979}
            alt="Contrast in context under the Kay lens: sixteen token pairs with their measured ratio, Kay's minimum and the result, in light and dark appearance, every row meeting its minimum."
            loading="lazy"
            decoding="async"
          />
          <img
            className="land-shot-front"
            src={`${PICTURES}/contrast-material.webp`}
            width={2000}
            height={420}
            alt="The same table under the Material lens, with Material's note on its recommended ratios."
            loading="lazy"
            decoding="async"
          />
        </figure>
      </div>
    </section>
  );
}

/** The four roles the one tool touches, under a label turned on its side. */
export function Roles() {
  return (
    <section className="land-roles" aria-labelledby="roles-heading">
      <p className="land-kicker land-roles-label" id="roles-heading">
        03 / One tool, four roles
      </p>
      {ROLES.map((entry, i) => (
        <div key={entry.role} className="land-role">
          <i aria-hidden="true">{String(i + 1).padStart(2, "0")}</i>
          <h3>{entry.role}</h3>
          <p>{entry.body}</p>
        </div>
      ))}
    </section>
  );
}

/** The closing word beside the seal. */
export function Closing() {
  return (
    <section className="land-close" aria-labelledby="close-heading">
      <Seal size={168} />
      <div>
        <blockquote id="close-heading">I built it before anyone asked.</blockquote>
        <p>
          Drift starts the first week people and agents share a codebase. The rules this tool keeps
          are the ones a team needs settled once: a missing reference is not a pass, CI cannot
          approve, and evidence outlives the run.
        </p>
        <div className="land-cta">
          <Link to="/" className="btn">
            Back to Kay
          </Link>
          <a className="btn" href="#pixels">
            See the pixels again
          </a>
        </div>
      </div>
    </section>
  );
}
