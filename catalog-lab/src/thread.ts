import { scenarios } from "./fixtures";
import type { RecapItem } from "./recapRules";

/** One turn in a thread; agent turns may carry a catalog payload the host validates. */
export type ThreadMessage =
  | { id: string; role: "user"; text: string; time: string }
  | {
      id: string;
      role: "agent";
      text: string;
      time: string;
      payload?: unknown;
    };

/** A deterministic conversation used to evaluate cards in their real context. */
export type Thread = {
  title: string;
  messages: ThreadMessage[];
  /** Structured outcomes recorded during the thread, shown after the user is away. */
  recap?: RecapItem[];
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
        kind: "done",
        text: "Charted closed cases for Sep 14–20: peak of 62 on Saturday.",
        turnId: "a1",
      },
      {
        kind: "done",
        text: "Compared teams: Support closed the most, 84 cases.",
        turnId: "a2",
      },
    ],
  },
  fallbacks: {
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
        kind: "done",
        text: "Showed the single reading as exact values instead of a trend.",
        turnId: "a1",
      },
      {
        kind: "needs-you",
        text: "A forecast view isn't available yet. Decide whether to request it.",
        turnId: "a2",
      },
    ],
  },
};
