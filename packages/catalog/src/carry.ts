import type { SharedCard } from "./share";

/** What a carry holds: a card lifted out of a thread, or the text of a highlight. */
export type Carried =
  | { kind: "card"; card: SharedCard; title: string }
  | { kind: "text"; text: string };

/** A point in the viewport, as a pointer event's `clientX` and `clientY` give it. */
export type CarryPoint = { x: number; y: number };

/** Somewhere a carry can land, registered with `acceptCarry` or `useCarryTarget`. */
export type CarryTarget = {
  /** The carry is over the target, called on every move there; false refuses it. */
  over(carried: Carried, at: CarryPoint): boolean;
  /** The carry left the target, landed elsewhere, or was cancelled. */
  leave(): void;
  /** The carry was released over the target, which accepted it on the last `over`. */
  drop(carried: Carried, at: CarryPoint): void;
};

// The target under the carry and its answer to the latest `over`.
type Hover = { target: CarryTarget; accepted: boolean };

/**
 * One press at a time: idle, armed by a press that has not travelled `LIFT_PX` yet, or
 * carrying once it has.
 */
export type CarryState =
  | { phase: "idle" }
  | { phase: "armed"; pointerId: number; from: CarryPoint; carried: Carried }
  | { phase: "carrying"; pointerId: number; carried: Carried; hover: Hover | null };

/**
 * What the page reports to the carry. `answer` is a target's reply to an `over` effect;
 * `pointercancel` covers a lost capture too; `cancel` is Escape or the window losing focus.
 */
export type CarryInput =
  | { kind: "press"; pointerId: number; at: CarryPoint; carried: Carried }
  | { kind: "move"; pointerId: number; at: CarryPoint; target: CarryTarget | null }
  | { kind: "answer"; target: CarryTarget; accepted: boolean }
  | { kind: "release"; pointerId: number; at: CarryPoint }
  | { kind: "pointercancel"; pointerId: number }
  | { kind: "cancel" };

/**
 * What the page does in response, in order. `lift` puts up the picture and the grabbing hand,
 * `follow` moves the picture, and `end` takes down whatever the press put up.
 */
export type CarryEffect =
  | { kind: "lift"; from: CarryPoint }
  | { kind: "follow"; at: CarryPoint }
  | { kind: "over"; target: CarryTarget; carried: Carried; at: CarryPoint }
  | { kind: "leave"; target: CarryTarget }
  | { kind: "drop"; target: CarryTarget; carried: Carried; at: CarryPoint }
  | { kind: "end"; lifted: boolean };

type Armed = Extract<CarryState, { phase: "armed" }>;
type Carrying = Extract<CarryState, { phase: "carrying" }>;

/** How far a press travels before it lifts; anything shorter is a click. */
export const LIFT_PX = 6;

const IDLE: CarryState = { phase: "idle" };

function travelled(from: CarryPoint, to: CarryPoint): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

// The carry at `at` over `target`: the old target hears `leave` before the new one hears
// `over`, and a target keeps hearing `over` on every move so it can follow the pointer.
function hoverOver(
  state: Carrying,
  target: CarryTarget | null,
  at: CarryPoint,
): [Carrying, CarryEffect[]] {
  const current = state.hover?.target ?? null;
  const effects: CarryEffect[] = [];
  if (current !== null && current !== target) effects.push({ kind: "leave", target: current });
  if (target !== null) effects.push({ kind: "over", target, carried: state.carried, at });
  return [{ ...state, hover: target === null ? null : { target, accepted: false } }, effects];
}

// The end of a carry that dropped nothing: whoever was under it hears `leave`.
function abandon(state: Carrying): [CarryState, CarryEffect[]] {
  const effects: CarryEffect[] = state.hover ? [{ kind: "leave", target: state.hover.target }] : [];
  return [IDLE, [...effects, { kind: "end", lifted: true }]];
}

function stepArmed(state: Armed, input: CarryInput): [CarryState, CarryEffect[]] {
  switch (input.kind) {
    case "move": {
      if (travelled(state.from, input.at) < LIFT_PX) return [state, []];
      const { pointerId, carried } = state;
      const lifted: Carrying = { phase: "carrying", pointerId, carried, hover: null };
      const [next, hover] = hoverOver(lifted, input.target, input.at);
      return [
        next,
        [{ kind: "lift", from: state.from }, { kind: "follow", at: input.at }, ...hover],
      ];
    }
    case "release":
    case "pointercancel":
    case "cancel":
      return [IDLE, [{ kind: "end", lifted: false }]];
    case "press":
    case "answer":
      return [state, []];
    default: {
      const unhandled: never = input;
      return unhandled;
    }
  }
}

function stepCarrying(state: Carrying, input: CarryInput): [CarryState, CarryEffect[]] {
  switch (input.kind) {
    case "move": {
      const [next, hover] = hoverOver(state, input.target, input.at);
      return [next, [{ kind: "follow", at: input.at }, ...hover]];
    }
    case "answer":
      return state.hover?.target === input.target
        ? [{ ...state, hover: { target: input.target, accepted: input.accepted } }, []]
        : [state, []];
    case "release": {
      if (state.hover === null || !state.hover.accepted) return abandon(state);
      const { target } = state.hover;
      return [
        IDLE,
        [
          { kind: "drop", target, carried: state.carried, at: input.at },
          { kind: "end", lifted: true },
        ],
      ];
    }
    case "pointercancel":
    case "cancel":
      return abandon(state);
    case "press":
      return [state, []];
    default: {
      const unhandled: never = input;
      return unhandled;
    }
  }
}

/**
 * The carry's rules, with no DOM: the next state and the effects the page performs, in order.
 * A press while another is armed or carrying is ignored, as is any pointer but the one that
 * pressed.
 */
export function stepCarry(state: CarryState, input: CarryInput): [CarryState, CarryEffect[]] {
  if (state.phase === "idle")
    return input.kind === "press"
      ? [{ phase: "armed", pointerId: input.pointerId, from: input.at, carried: input.carried }, []]
      : [state, []];
  if ("pointerId" in input && input.pointerId !== state.pointerId) return [state, []];
  return state.phase === "armed" ? stepArmed(state, input) : stepCarrying(state, input);
}
