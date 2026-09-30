import type { Selection } from "@yaklabs/catalog/catalog";
import type { PlaygroundEvent, UserInput } from "@yaklabs/catalog/playground";
import {
  initialPlayground,
  reducePlayground,
  type PlaygroundAction,
  type PlaygroundState,
} from "./state";

/** A small valid bar chart card titled `title`. */
export function barCard(title: string): Selection {
  return {
    catalogVersion: "1",
    component: "BarChart",
    props: {
      title,
      source: "Illustrative numbers",
      unit: "cases",
      variant: "comparison",
      rows: [
        { label: "Mon", value: 4 },
        { label: "Tue", value: 7 },
      ],
    },
  };
}

/** A question the reply can wait on. */
export const QUESTION = {
  question: "Which week should I chart?",
  options: [{ label: "This week" }, { label: "Last week" }],
  answer: { placeholder: "Or name a week" },
};

/** The user's message `text`. */
export const say = (text: string): UserInput => ({ kind: "say", text });

/** A send action for exchange `id`. */
export const send = (id: string, user: UserInput): PlaygroundAction => ({
  kind: "send",
  exchangeId: id,
  user,
  at: "9:00 AM",
});

/** An event action for exchange `id`. */
export const event = (id: string, value: PlaygroundEvent): PlaygroundAction => ({
  kind: "event",
  exchangeId: id,
  event: value,
});

/** Folds `actions` into the empty page, in order. */
export function run(actions: PlaygroundAction[], from = initialPlayground): PlaygroundState {
  return actions.reduce((state, action) => reducePlayground(state, action), from);
}

/** Sends "hi" as exchange x1, then feeds it `events`. */
export function streamed(events: PlaygroundEvent[]): PlaygroundState {
  return run([send("x1", say("hi")), ...events.map((value) => event("x1", value))]);
}
