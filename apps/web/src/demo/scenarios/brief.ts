import { card, em, heading, list, paragraph, strong, text } from "@yaklabs/catalog/prose";
import { activity, at, log, stream, sumUp, type Script, type Timed } from "../script";
import {
  done,
  issuesChart,
  orderQuestion,
  responsePie,
  running,
  step,
  workloadChart,
} from "./fixtures";

// Scenario 1: the whole arc. A request, quiet narration, three children working in parallel,
// a finding with selective emphasis and a card between its paragraphs, a chart the catalog
// refuses, one real decision, and an honest draft. About 60 seconds at 1x before reading time.
const briefFinding = stream(
  [
    paragraph([
      text("The backlog fell from "),
      strong("46 cases on Monday to 18 by Friday"),
      text(
        ". That is the steepest weekday drop since August, and it happened without anyone working the weekend.",
      ),
    ]),
    paragraph([
      text("Of the 18 still open, "),
      strong("12 are billing"),
      text(
        ". Most arrived after Wednesday's invoice run, so they are recent rather than stuck: the median billing case has been open for two days.",
      ),
    ]),
    card(workloadChart),
    paragraph([
      em("Weekend activity was not collected."),
      text(
        " This is a weekday comparison, not a complete week, so Saturday's usual spike is missing from these numbers.",
      ),
    ]),
    paragraph([
      text("First responses slowed: the median was "),
      strong("41 minutes"),
      text(", up from 28 the week before, and Thursday was the slowest day."),
    ]),
    card(responsePie),
    heading([text("What I'd flag")]),
    list([
      [strong("Access requests"), text(" are few but old: two cases, nine days open on average.")],
      [strong("Product questions"), text(" are steady at four, none older than a week.")],
      [text("Nothing here needs an escalation today.")],
    ]),
  ],
  500,
);

const briefDraft = (order: "oldest" | "billing"): Timed[] =>
  stream(
    [
      heading([text("Monday support brief (draft)")]),
      order === "oldest"
        ? paragraph([
            text("Leading with the "),
            strong("longest-open cases"),
            text(", as you asked, rather than the largest category."),
          ])
        : paragraph([
            text("Leading with "),
            strong("billing"),
            text(", the largest open category, as you asked."),
          ]),
      list(
        order === "oldest"
          ? [
              [strong("Access"), text(": 2 open, median 9 days. Both wait on the identity team.")],
              [strong("Product"), text(": 4 open, median 6 days.")],
              [strong("Billing"), text(": 12 open, median 2 days. Recent, not stuck.")],
            ]
          : [
              [strong("Billing"), text(": 12 open, median 2 days. Recent, not stuck.")],
              [strong("Product"), text(": 4 open, median 6 days.")],
              [strong("Access"), text(": 2 open, median 9 days. Both wait on the identity team.")],
            ],
      ),
      card(issuesChart),
      paragraph([
        text(
          "Nothing was sent. The draft is yours to edit, and the evidence behind each line is in ",
        ),
        strong("Work details"),
        text(" above."),
      ]),
    ],
    400,
  );

/** Scenario 1: the whole arc. */
export const brief: Script = {
  id: "brief",
  label: "Weekly brief",
  shows:
    "The whole arc: narration, parallel checks, a refused chart, a finding, a decision, a draft.",
  standing: "Shipped: every surface here. Scripted: the agent, its data and its checks.",
  project: "Support desk",
  thread: "Weekly brief",
  children: {
    workload: {
      title: "Weekly workload",
      request: "Count the open cases at the end of each weekday.",
    },
    issues: {
      title: "Open issues by category",
      request: "Group Friday's open cases by category with their median age.",
    },
    response: {
      title: "First response times",
      request: "Find the median first-response time for each weekday.",
    },
  },
  beats: [
    {
      kind: "user",
      after: 900,
      text: "Can you prepare Monday's support brief? Pull last week's numbers and tell me what changed. Don't send anything yet.",
    },
    {
      kind: "reply",
      events: [
        activity(700, "Thinking."),
        activity(1100, "Reading the support records."),
        log(600, "source: support-desk fixtures · weekdays Sep 22 to 26 · 2 files"),
        step(500, running("workload", "Weekly workload")),
        step(400, running("issues", "Open issues by category")),
        step(300, running("response", "First response times")),
        activity(300, "Checking this week's workload, open issues and response times."),
        step(
          2800,
          done(
            "workload",
            "Weekly workload",
            "Backlog fell from 46 cases Monday to 18 by Friday.",
            workloadChart,
          ),
        ),
        log(200, "check:weekly-workload status=done rows=5 columns=[day, open_cases]"),
        step(
          2000,
          done(
            "issues",
            "Open issues by category",
            "18 cases remain open: 12 billing, 4 product, 2 access.",
            issuesChart,
          ),
        ),
        log(
          200,
          "check:open-issues status=done rows=3 columns=[category, open_cases, median_days_open]",
        ),
        step(
          1400,
          done(
            "response",
            "First response times",
            "Median first response 41 minutes, up from 28 the week before.",
            responsePie,
          ),
        ),
        log(200, "check:response-times status=done rows=5 chart=PieChart"),
        activity(400, "Writing the brief."),
        ...briefFinding,
        sumUp(0, "Checked workload, open issues and response times"),
        at(700, { kind: "question", question: orderQuestion }),
      ],
    },
    { kind: "answer", after: 4500, text: "Oldest first" },
    {
      kind: "reply",
      events: [activity(500, "Drafting the brief, oldest first."), ...briefDraft("oldest")],
    },
  ],
};
