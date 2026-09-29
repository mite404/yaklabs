import type { Selection } from "@yaklabs/catalog/catalog";
import type { ChildKey, Choice } from "./state";
import { em, heading, link, list, paragraph, strong, text, type Block } from "./quiet-prose";

/** What each child check is called, in the sidebar and in its evidence. */
export const CHILD_LABELS: Record<ChildKey, string> = {
  workload: "Weekly workload",
  issues: "Open issues",
};

// The backlog fell every weekday; the weekend was never in scope, so it is simply absent
// from this row set rather than shown as a false zero.
export const workloadChart = {
  catalogVersion: "1",
  component: "LineChart",
  props: {
    title: "Backlog, Monday to Friday",
    source: "Demo support desk · fixture data, weekdays only",
    unit: "cases",
    variant: "trend",
    rows: [
      { label: "Mon", value: 46 },
      { label: "Tue", value: 39 },
      { label: "Wed", value: 31 },
      { label: "Thu", value: 24 },
      { label: "Fri", value: 18 },
    ],
  },
} satisfies Selection;

// Friday's 18 open cases, by category; every category also carries a median age so the
// draft can honestly offer an oldest-first order and not just a biggest-first one.
const CATEGORY_FIXTURES = [
  { name: "Billing", open: 12, medianDaysOpen: 2 },
  { name: "Product", open: 4, medianDaysOpen: 6 },
  { name: "Access", open: 2, medianDaysOpen: 9 },
];

export const issuesChart = {
  catalogVersion: "1",
  component: "BarChart",
  props: {
    title: "What's still open Friday, by category",
    source: "Demo support desk · fixture data, weekdays only",
    unit: "cases",
    variant: "comparison",
    rows: CATEGORY_FIXTURES.map((category) => ({ label: category.name, value: category.open })),
  },
} satisfies Selection;

/** Plain fixture records, not a claim of a real tool run against a live system. */
export const technicalLogs = [
  "fixture:workload.csv rows=5 columns=[day,open_cases] range=Mon..Fri",
  "fixture:issues.csv rows=3 columns=[category,open_cases,median_days_open]",
  "check:weekly-workload status=done source=fixture",
  "check:open-issues status=done source=fixture",
  "note: scripted demo data - not a live query against any system",
];

/** What each child reports once it finishes, shown with no animation (ADR-139). */
export const childOutcome: Record<ChildKey, string> = {
  workload: "Backlog fell from 46 cases Monday to 18 by Friday.",
  issues: "18 cases remain open: 12 billing, 4 product, 2 access.",
};

export const findingBlocks: Block[] = [
  paragraph([
    text("The backlog fell from "),
    strong("46 cases Monday to 18 by Friday"),
    text(", and "),
    strong("12 of those 18 are billing"),
    text("."),
  ]),
  paragraph([
    em("Weekend activity was not collected"),
    text(". This is a weekday comparison, not a complete week."),
  ]),
];

function byOpenDescending() {
  return CATEGORY_FIXTURES.toSorted((a, b) => b.open - a.open);
}

function byAgeDescending() {
  return CATEGORY_FIXTURES.toSorted((a, b) => b.medianDaysOpen - a.medianDaysOpen);
}

/** The category order a choice implies: biggest first, oldest first, or (typed) the honest
 * default of oldest first, since free text carries no ordering this demo can read. */
function orderFor(choice: Choice) {
  return choice.kind === "billing" ? byOpenDescending() : byAgeDescending();
}

function leadFor(choice: Choice): Block {
  if (choice.kind === "billing")
    return paragraph([
      text("Leading with "),
      strong("billing"),
      text(", the largest open category at "),
      strong("12 cases"),
      text("."),
    ]);
  if (choice.kind === "oldest")
    return paragraph([
      text("Leading with "),
      strong("the longest-open category"),
      text(", since you asked to prioritize by age rather than size."),
    ]);
  return paragraph([
    text(`You typed: "${choice.text}". `),
    em("This demo can't interpret free-form instructions"),
    text(
      ", so the draft below defaults to the oldest-open order; your note is kept here for a person to read.",
    ),
  ]);
}

/**
 * The draft body for a given choice (ADR-039, ADR-040 spirit: only what was actually asked for
 * shapes the output). Billing and oldest genuinely reorder the same evidence; a typed answer is
 * echoed verbatim rather than pretended to be understood.
 */
export function draftBlocks(choice: Choice): Block[] {
  const ordered = orderFor(choice);
  return [
    heading([text("Monday support brief (draft)")]),
    leadFor(choice),
    list(
      ordered.map((category) => [
        strong(category.name),
        text(`: ${category.open} open. Median age: ${category.medianDaysOpen} days.`),
      ]),
    ),
    paragraph([
      text("Check the "),
      link("support evidence", "#brief-evidence"),
      text(" before sharing. Nothing was sent, and no account changed."),
    ]),
    paragraph([text("Your draft is ready.")]),
  ];
}
