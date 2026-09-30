import type { AwaitingInput } from "@yaklabs/catalog/awaiting";
import type { Selection } from "@yaklabs/catalog/catalog";
import type { WorkStep } from "@yaklabs/catalog/reply";
import { at, type Timed } from "../script";

// Every payload here is fixture data, named as such on the card, never a claim of a live query.
const SOURCE = "Demo support desk · fixture data, weekdays Sep 22 to 26";

/** Last week's backlog by weekday. */
export const workloadChart = {
  catalogVersion: "1",
  component: "LineChart",
  props: {
    title: "Backlog, Monday to Friday",
    source: SOURCE,
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

/** Friday's open cases by category. */
export const issuesChart = {
  catalogVersion: "1",
  component: "BarChart",
  props: {
    title: "Still open on Friday, by category",
    source: SOURCE,
    unit: "cases",
    variant: "comparison",
    rows: [
      { label: "Billing", value: 12 },
      { label: "Product", value: 4 },
      { label: "Access", value: 2 },
    ],
  },
} satisfies Selection;

/** September's matched invoices by site. */
export const sitesChart = {
  catalogVersion: "1",
  component: "BarChart",
  props: {
    title: "September invoices matched, by site",
    source: "Demo supplier ledger · fixture data, September",
    unit: "cases",
    variant: "comparison",
    rows: [
      { label: "Northern", value: 84 },
      { label: "Southern", value: 67 },
      { label: "Central", value: 61 },
    ],
  },
} satisfies Selection;

/** The one decision the weekly brief asks for. */
export const orderQuestion = {
  question: "How should Monday's brief order the backlog?",
  options: [
    { label: "Billing first", detail: "Lead with the largest open category." },
    { label: "Oldest first", detail: "Lead with the cases waiting longest, whatever their size." },
  ],
  answer: { placeholder: "Or name the order you want" },
  elsewhere: "Skip the draft for now",
} satisfies AwaitingInput;

/** The one decision left when the user comes back to the September invoices. */
export const holdQuestion = {
  question: "Two southern invoices bill more than was delivered. What should happen to them?",
  options: [
    { label: "Hold them", detail: "Mark both for review; nothing is paid until someone looks." },
    { label: "Pay what arrived", detail: "Pay the delivered amount and query the difference." },
  ],
  answer: { placeholder: "Or say what you'd rather do" },
  elsewhere: "Leave them for now",
} satisfies AwaitingInput;

/** A step of the work after a pause. */
export const step = (after: number, work: WorkStep): Timed =>
  at(after, { kind: "step", step: work });
/** A child thread's step, just started. */
export const running = (id: string, label: string): WorkStep => ({
  id,
  label,
  status: "running",
  threadId: id,
});
/** A child thread's step, finished, with what it found and the card that backs it. */
export const done = (id: string, label: string, outcome: string, evidence?: unknown): WorkStep => ({
  id,
  label,
  status: "done",
  outcome,
  evidence,
  threadId: id,
});
