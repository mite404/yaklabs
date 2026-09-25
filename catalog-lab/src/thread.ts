import { scenarios } from "./fixtures";
import type { CardAttachment } from "./interactive";
import type { RecapItem } from "./recapRules";

/** One turn in a thread; agent turns may carry a catalog payload the host validates. */
export type ThreadMessage =
  | {
      id: string;
      role: "user";
      text: string;
      time: string;
      /** Card choices sent with this message, shown as chips under it (ADR-030). */
      attachments?: CardAttachment[];
    }
  | {
      id: string;
      role: "agent";
      text: string;
      time: string;
      payload?: unknown;
      /** An interactive catalog card (ADR-029), validated separately from static cards. */
      interactive?: unknown;
      /** Arrives word by word, the way a live agent reply streams in. */
      stream?: boolean;
    };

/** A deterministic conversation used to evaluate cards in their real context. */
export type Thread = {
  title: string;
  messages: ThreadMessage[];
  /** Structured outcomes recorded during the thread, shown after the user is away. */
  recap?: RecapItem[];
  /** A question the agent is blocked on (ADR-039), validated before it is shown. */
  awaiting?: unknown;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const byDay = (values: number[]) => values.map((value, i) => ({ label: DAYS[i], value }));

/** Last week's profit at three depths; every stop is precomputed so the slider never calls a model. */
export const profitCard = {
  catalogVersion: "1",
  component: "BarChart",
  props: {
    title: "Last week's profit by day",
    source: "Demo store sales · Sep 14–20",
    period: "Sep 14–20",
    unit: "USD",
    variant: "measure-steps",
    control: {
      label: "Profit measure",
      initial: "gross",
      stops: [
        {
          id: "gross",
          label: "Gross profit",
          description: "Sales minus the cost of the goods you sold.",
          rows: byDay([6200, 7100, 6800, 7900, 9400, 11200, 8600]),
        },
        {
          id: "operating",
          label: "Operating profit",
          description: "Gross profit minus rent, salaries, and other running costs.",
          rows: byDay([2900, 3800, 3500, 4600, 6100, 7900, 5300]),
        },
        {
          id: "net",
          label: "Net profit",
          description: "Operating profit minus interest and tax: what you keep.",
          rows: byDay([2200, 2850, 2600, 3450, 4600, 5900, 4000]),
        },
      ],
    },
    sentence: "{measure} was {total} for {period}, peaking on {peakLabel} at {peakValue}.",
    steps: [
      "Pulled last week's orders (Sep 14–20) from the sales system",
      "Grouped sales by day",
      "Subtracted cost of goods sold to get gross profit",
      "Subtracted operating costs to get operating profit",
      "Subtracted interest and tax to get net profit",
      "Linked the slider to those three results",
    ],
  },
};

// Edge cases: a single reading and a view the catalog does not have.
const fallbacks: Thread = {
  title: "Checking the edges",
  messages: [
    {
      id: "u1",
      role: "user",
      time: "14:10",
      text: scenarios.sparse.question,
    },
    {
      id: "a1",
      role: "agent",
      time: "14:10",
      text: "There is only one known reading, so I can't draw a trend honestly. Here are the exact values.",
      payload: scenarios.sparse.payload,
    },
    {
      id: "u2",
      role: "user",
      time: "14:12",
      text: scenarios.unsupported.question,
    },
    {
      id: "a2",
      role: "agent",
      time: "14:12",
      text: "That view isn't in the catalog yet, so I haven't guessed at one.",
      payload: scenarios.unsupported.payload,
    },
  ],
  recap: [
    {
      text: "Showed the single reading as exact values instead of a trend.",
      turnId: "a1",
    },
  ],
};

// Synthetic conversations: every payload comes from the shared fixtures,
// so a card in a thread and a card in a story are the exact same input.
export const threads: Record<string, Thread> = {
  trend: {
    title: "Service desk weekly review",
    messages: [
      {
        id: "u1",
        role: "user",
        time: "9:02",
        text: scenarios.trend.question,
      },
      {
        id: "a1",
        role: "agent",
        time: "9:02",
        text: "Closed cases rose from 24 on Monday to a peak of 62 on Saturday, then eased slightly on Sunday.",
        payload: scenarios.trend.payload,
      },
      {
        id: "u2",
        role: "user",
        time: "9:04",
        text: scenarios.comparison.question,
      },
      {
        id: "a2",
        role: "agent",
        time: "9:04",
        text: "Support closed the most, 84 cases, followed by Operations at 71.",
        payload: scenarios.comparison.payload,
      },
    ],
    recap: [
      {
        text: "Charted closed cases for Sep 14–20: peak of 62 on Saturday.",
        turnId: "a1",
      },
      {
        text: "Compared teams: Support closed the most, 84 cases.",
        turnId: "a2",
      },
    ],
  },
  profit: {
    title: "Last week's sales",
    messages: [
      {
        id: "u1",
        role: "user",
        time: "10:02",
        text: "Make a graph of last week's sales. Build a slider underneath that slides from net to gross profit.",
      },
      {
        id: "a1",
        role: "agent",
        time: "10:02",
        text: "Here's last week's profit by day. I used three stops instead of a free slider, since there's nothing between net and gross profit; the middle stop shows where the money goes.",
        interactive: profitCard,
      },
    ],
  },
  fallbacks,
  /** The fallbacks thread with the agent blocked on the user: whether to request the missing view. */
  awaiting: {
    ...fallbacks,
    awaiting: {
      question: "A forecast view isn't in the catalog yet. How should I handle it?",
      options: [
        {
          label: "Request a forecast view",
          detail: "I'll add it to the catalog backlog and keep showing exact values until it ships.",
        },
      ],
      answer: { placeholder: "How many weeks ahead should it forecast?" },
      elsewhere: "Chat about a plan to capture a different selection of sales data",
    },
  },
  /** The same question, malformed: the way out was written into the one-line typed-answer
   *  row, too long to fit, so there is no card; the agent asks in plain words (ADR-040). */
  malformed: {
    ...fallbacks,
    awaiting: {
      question: "A forecast view isn't in the catalog yet. How should I handle it?",
      options: [
        {
          label: "Request a forecast view",
          detail: "I'll add it to the catalog backlog and keep showing exact values until it ships.",
        },
      ],
      answer: { placeholder: "Chat about a plan to capture a different selection of sales data" },
    },
  },
};
