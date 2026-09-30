import { card, list, paragraph, strong, text } from "@yaklabs/catalog/prose";
import { activity, log, stream, type Script } from "../script";
import { done, running, sitesChart, step } from "./fixtures";

// Scenario 3: work that runs in the background. Three children run in parallel; the user asks
// something else meanwhile and gets an answer in its own turn; then stops the long job, and the
// record says what finished and what was cut short.
/** Scenario 3: work in the background, a question meanwhile, and a stop. */
export const background: Script = {
  id: "background",
  label: "Working in the background",
  shows: "Three children run while the user keeps talking, then stops the job.",
  project: "Operations",
  thread: "September invoices",
  children: {
    north: {
      title: "Northern warehouse",
      request: "Match September's invoices to deliveries at the northern warehouse.",
    },
    south: {
      title: "Southern warehouse",
      request: "Match September's invoices to deliveries at the southern warehouse.",
    },
    central: {
      title: "Central depot",
      request: "Match September's invoices to deliveries at the central depot.",
    },
  },
  beats: [
    {
      kind: "user",
      after: 900,
      text: "Go through all of September's supplier invoices and match them to deliveries. Flag anything that doesn't line up.",
    },
    {
      kind: "reply",
      events: [
        activity(700, "Thinking."),
        activity(1000, "Opening the September invoices."),
        log(500, "source: supplier-ledger fixtures · September · 212 invoices · 3 sites"),
        step(400, running("north", "Northern warehouse")),
        step(300, running("south", "Southern warehouse")),
        step(300, running("central", "Central depot")),
        activity(300, "Matching 212 invoices to deliveries across three sites."),
        step(
          3000,
          done(
            "north",
            "Northern warehouse",
            "84 invoices matched; 3 deliveries have no invoice yet.",
          ),
        ),
        log(100, "match:north invoices=84 unmatched_deliveries=3"),
        step(
          3000,
          done("central", "Central depot", "61 invoices matched; every delivery accounted for."),
        ),
        log(100, "match:central invoices=61 unmatched_deliveries=0"),
        step(
          9000,
          done(
            "south",
            "Southern warehouse",
            "67 invoices matched; 2 bill more than was delivered.",
            sitesChart,
          ),
        ),
        log(100, "match:south invoices=67 over_billed=2"),
        activity(400, "Writing the summary."),
        ...stream(
          [
            paragraph([
              strong("212 invoices matched to deliveries across three sites."),
              text(
                " Five need a look: three deliveries at the northern warehouse have no invoice yet, and two southern invoices bill more than arrived.",
              ),
            ]),
            card(sitesChart),
            paragraph([
              text("Nothing was changed or sent. The per-site detail is in Work details."),
            ]),
          ],
          400,
        ),
      ],
    },
    {
      kind: "user",
      after: 5200,
      overlap: true,
      text: "While that runs: who owns billing escalations this month?",
    },
    {
      kind: "reply",
      events: [
        activity(600, "Checking the on-call sheet."),
        ...stream(
          [
            paragraph([
              strong("Priya Nair"),
              text(" owns billing escalations for September, with "),
              strong("Tom Reyes"),
              text(" covering Fridays. Both are on the on-call sheet in the Operations project."),
            ]),
          ],
          500,
        ),
      ],
    },
    { kind: "stop", after: 1800 },
    {
      kind: "user",
      after: 2200,
      text: "Stopping was right, I only need the northern warehouse. Give me that one.",
    },
    {
      kind: "reply",
      events: [
        activity(600, "Reading the northern warehouse result."),
        ...stream(
          [
            paragraph([
              strong(
                "Northern warehouse: 84 invoices matched, 3 deliveries without an invoice yet.",
              ),
              text(
                " All three arrived in the last week of September, so the invoices may simply not be in yet.",
              ),
            ]),
            list([
              [strong("D-4471"), text(": Sep 24, 12 pallets, no invoice.")],
              [strong("D-4480"), text(": Sep 26, 4 pallets, no invoice.")],
              [strong("D-4483"), text(": Sep 29, 9 pallets, no invoice.")],
            ]),
            paragraph([
              text(
                "The southern and central sites were stopped before they finished; their partial results are kept in Work details on the earlier turn.",
              ),
            ]),
          ],
          400,
        ),
      ],
    },
  ],
};
