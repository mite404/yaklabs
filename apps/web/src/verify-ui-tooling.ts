// The design tooling page’s words (ADR-160): the numbers, the beats of a run, the transcript
// and the rows the page lays out, kept apart from the page so the copy reads as one piece.

/** Where the page's pictures live, under public/, with their credits beside them. */
export const PICTURES = "/verify-ui-tooling";

/** A run's shape in numbers, as the review app's summary row puts it. */
export const STATS = [
  { label: "Rendering engines", value: "3", unit: "Chromium, Firefox, WebKit" },
  { label: "Themes", value: "2", unit: "light and dark" },
  { label: "Stories in the inventory", value: "85", unit: "+ the app shell" },
  { label: "References CI can approve", value: "0", unit: "a person decides" },
];

/** Why the check has to be a tool: the three ways a visual change gets through a review. */
export const PROBLEMS = [
  {
    title: "Looks fine is not a test",
    body: "A reviewer’s eye compares a screenshot with a memory of last week’s build. Memory is the weakest reference in the building.",
  },
  {
    title: "Agents move faster than review",
    body: "An agent revises UI in minutes. The check has to run at that speed, and be the same check every time, on every engine and theme.",
  },
  {
    title: "Consistency at scale is a records problem",
    body: "Every approved look has to be findable, dated and tied to its commit. Otherwise the standard is whoever was in the room.",
  },
];

/** The five beats of a run, in order. */
export const STEPS = [
  {
    title: "Capture",
    body: "The CLI builds the current Storybook and photographs the production components through their own stories, in three engines and both themes.",
  },
  {
    title: "Prove the camera",
    body: "Before any comparison counts, the tool recaptures an untouched Button, then a wrong colour and a wrong padding. The control must match. Both mistakes must differ.",
  },
  {
    title: "Compare",
    body: "Each capture meets its approved reference for that engine, theme and machine. A missing reference is reported as missing, never as a pass.",
  },
  {
    title: "Check",
    body: "Tokens are read off the rendered CSS, every declared colour pair is measured for contrast in both themes, and axe runs on every story.",
  },
  {
    title: "Decide and keep",
    body: "A verdict with its reasons, a report and the comparison images are saved for the run. Only a person can approve a new reference.",
  },
];

/** The shell the terminal picture showed: its window, its prompt bar, and the command typed. */
export const SHELL = {
  title: "yaklabs — zsh",
  path: "~/Programming/web/fractal/yaklabs/apps",
  branch: "main",
  time: "01:36:08 AM",
  program: "pnpm",
  args: "verify-ui-drift run",
};

/** The comparator proof's counts for each engine, as the review app tabled them. */
export const PROOF = [
  { engine: "chromium", control: 0, color: 7735, geometry: 15600 },
  { engine: "firefox", control: 0, color: 7740, geometry: 16497 },
  { engine: "webkit", control: 0, color: 8023, geometry: 15863 },
];

/** Four measured token pairs under the Kay lens, light appearance, with the minimum each clears. */
export const PAIRS = [
  { pair: "--ink on --paper", ratio: 13.33, minimum: 4.5 },
  { pair: "--soft-ink on --paper", ratio: 6.42, minimum: 4.5 },
  { pair: "--rule on --paper", ratio: 5.68, minimum: 3 },
  { pair: "--focus on --paper", ratio: 3.01, minimum: 3 },
];

/** The run the terminal picture showed, as the CLI printed it, with the home path shortened. */
export const RUN = {
  command: "pnpm verify-ui-drift run",
  lines: [
    "> yaklabs@ verify-ui-drift ~/yaklabs",
    "> pnpm --filter verify-ui-drift cli run",
    "",
    "> verify-ui-drift@ cli ~/yaklabs/tools/verify-ui-drift",
    "> node src/cli.ts run",
    "",
    "Building current Storybook for bee310fdcbe6",
  ],
  notice:
    "No approved references exist for this machine (darwin-arm64), so captures are recorded but not compared. References exist for: linux-x64-debian-12.",
  rest: [
    "chromium proof ok: control 0, color 7735, geometry 15600",
    "foundations-button--default.chromium.light missing-baseline axe=0",
    "foundations-text-field--on-paper.chromium.light missing-baseline axe=0",
    "foundations-text-field--inside-recap-and-needs-you.chromium.light missing-baseline axe=0",
    "foundations-disclosure--folded.chromium.light missing-baseline axe=0",
    "foundations-disclosure--open.chromium.light missing-baseline axe=0",
    "firefox proof ok: control 0, color 7740, geometry 16497",
    "foundations-button--default.firefox.light missing-baseline axe=0",
    "webkit proof ok: control 0, color 8023, geometry 15863",
    "foundations-button--default.webkit.light missing-baseline axe=0",
    "…",
  ],
};

/** The four verdicts, from the tool's README. */
export const VERDICTS = [
  {
    verdict: "PASS",
    exit: "0",
    meaning: "Every capture matches its reference and axe found nothing.",
    trust: "Yes",
  },
  {
    verdict: "FAIL",
    exit: "1",
    meaning: "Captures changed or axe found violations. Each one is listed.",
    trust: "Decide each one",
  },
  {
    verdict: "INCOMPLETE",
    exit: "2",
    meaning:
      "Part of the run was not compared: no reference for this machine, an engine that did not run, or a failed camera proof.",
    trust: "No, it is unverified",
  },
  {
    verdict: "BROKEN",
    exit: "3",
    meaning: "The run did not finish cleanly. The cause is printed.",
    trust: "No, do not use it",
  },
];

/** Rows of the results list on a machine with no references of its own. */
export const MISSING = [
  { story: "Button / Default", file: "Button.stories.tsx", engine: "firefox", theme: "dark" },
  {
    story: "Text Field / On Paper",
    file: "TextField.stories.tsx",
    engine: "firefox",
    theme: "dark",
  },
  { story: "Disclosure / Open", file: "Disclosure.stories.tsx", engine: "firefox", theme: "dark" },
  { story: "Button / Default", file: "Button.stories.tsx", engine: "webkit", theme: "light" },
];

/** What approval is, and what the CLI refuses. */
export const APPROVAL = [
  "A person names the captures to approve and how many to expect. The command fails if the count is off.",
  "Approval writes the PNG and an approved.json beside the code. They are committed together, so the reference carries the commit that chose it.",
  "The CLI rejects stale or incomplete evidence, a failed camera proof, an altered image and any selected capture with an axe violation.",
  "CI cannot approve. It can only compare, and attach its evidence to the pull request for a person to open.",
];

/** Where the work lands, by the role it speaks to. */
export const ROLES = [
  {
    role: "Design engineering",
    body: "The components are production code and Storybook is their contract. Corners, tokens and contrast are checked in the rendered CSS, against Kay’s own minimums.",
  },
  {
    role: "Design engineering infrastructure",
    body: "Four verdicts, four exit codes, references kept per machine, a CI artifact a reviewer opens locally, and a camera that proves itself before a comparison counts.",
  },
  {
    role: "Frontend engineering",
    body: "A React review app over Playwright captures in Chromium, Firefox and WebKit, with a before/after wipe on one coordinate plane and a pixel inspector that never smooths.",
  },
  {
    role: "Forward deployed engineering",
    body: "Every run leaves evidence a non-engineer can read: a verdict, the reason, and what to do next.",
  },
];
