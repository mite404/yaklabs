import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
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

/** The press that arms a carry: a DOM `PointerEvent` or React's. */
export type CarryPress = Pick<
  PointerEvent,
  "pointerId" | "button" | "clientX" | "clientY" | "target" | "preventDefault"
>;

/** Where a carry comes from and what rides the pointer while it is carried. */
export type CarrySource = {
  carried: Carried;
  /** The element that dims while it is carried; its clone rides the pointer unless `picture` builds one. */
  lift?: HTMLElement;
  /** Builds what rides the pointer, such as a quote chip for text. */
  picture?: () => HTMLElement;
};

type Armed = Extract<CarryState, { phase: "armed" }>;
type Carrying = Extract<CarryState, { phase: "carrying" }>;

// The picture on screen and how far its corner sits from the pointer.
type Ghost = { element: HTMLElement; offset: CarryPoint };

// One press in the page: the element it landed on holds the pointer once it lifts, and the
// ghost exists from the lift to the end.
type Press = {
  pointerId: number;
  source: CarrySource;
  captor: Element | null;
  listening: AbortController;
  ghost: Ghost | null;
};

/** How far a press travels before it lifts; anything shorter is a click. */
export const LIFT_PX = 6;

// A picture of its own, such as a quote chip, hangs this far below and right of the pointer.
const PICTURE_OFFSET_PX = 12;

const IDLE: CarryState = { phase: "idle" };

// The page's one carry and the elements that accept one.
let carry: CarryState = IDLE;
const targets = new Map<Element, CarryTarget>();

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

// A target's answer to `over`, kept only while that target is still under the carry.
function answered(state: Carrying, target: CarryTarget, accepted: boolean): Carrying {
  return state.hover?.target === target ? { ...state, hover: { target, accepted } } : state;
}

// A release drops on the target under the carry if it accepted, and drops nothing otherwise.
function land(state: Carrying, at: CarryPoint): [CarryState, CarryEffect[]] {
  if (state.hover === null || !state.hover.accepted) return abandon(state);
  const drop: CarryEffect = {
    kind: "drop",
    target: state.hover.target,
    carried: state.carried,
    at,
  };
  return [IDLE, [drop, { kind: "end", lifted: true }]];
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
      return [answered(state, input.target, input.accepted), []];
    case "release":
      return land(state, input.at);
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

function pointOf(event: Pick<PointerEvent, "clientX" | "clientY">): CarryPoint {
  return { x: event.clientX, y: event.clientY };
}

// The registered target at a point: the element there or its nearest registered ancestor.
// The ghost has `pointer-events: none`, so it is never the element there.
function targetAt(at: CarryPoint): CarryTarget | null {
  for (let node = document.elementFromPoint(at.x, at.y); node; node = node.parentElement) {
    const target = targets.get(node);
    if (target) return target;
  }
  return null;
}

// The name and content width of the size container nearest `element`, so a clone laid out
// away from home still matches the container queries it matched at home.
function containerOf(element: Element): { name: string; width: number } | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.containerType === "normal") continue;
    const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    return { name: style.containerName, width: node.clientWidth - padding };
  }
  return null;
}

function frame(picture: Node, offset: CarryPoint): Ghost {
  const element = document.createElement("div");
  element.className = "carry-ghost";
  element.setAttribute("aria-hidden", "true");
  element.inert = true;
  element.append(picture);
  return { element, offset };
}

// The picture that rides the pointer, placed where it starts: a picture of its own hangs off
// the pointer; a clone of the lifted element sits exactly over it, at its size.
function ghostOf({ lift, picture }: CarrySource, from: CarryPoint): Ghost | null {
  if (picture) return frame(picture(), { x: PICTURE_OFFSET_PX, y: PICTURE_OFFSET_PX });
  if (!lift) return null;
  const box = lift.getBoundingClientRect();
  const ghost = frame(lift.cloneNode(true), { x: box.left - from.x, y: box.top - from.y });
  const { style } = ghost.element;
  style.setProperty("--carry-width", `${box.width}px`);
  const container = containerOf(lift);
  if (container) {
    style.containerType = "inline-size";
    style.containerName = container.name;
    style.width = `${container.width}px`;
  }
  return ghost;
}

// A lifted press ends without a click, as a native drag does, so nothing under the release
// reads it as one. That click comes from the pointer, counting one or more, before any other
// press: the next press disarms this, for a carry that ended before its release, and a click
// from the keyboard, which counts none, passes.
function swallowStrayClick(): void {
  const swallow = (event: MouseEvent) => {
    if (event.detail === 0) return;
    event.preventDefault();
    event.stopPropagation();
    disarm();
  };
  const disarm = () => {
    window.removeEventListener("click", swallow, true);
    window.removeEventListener("pointerdown", disarm, true);
  };
  window.addEventListener("click", swallow, true);
  window.addEventListener("pointerdown", disarm, true);
}

function putUp(press: Press, from: CarryPoint): void {
  const { source, captor, pointerId } = press;
  press.ghost = ghostOf(source, from);
  if (press.ghost) document.body.append(press.ghost.element);
  if (source.lift) source.lift.dataset.lifted = "";
  document.documentElement.dataset.carrying = source.carried.kind;
  captor?.setPointerCapture(pointerId);
}

function takeDown(press: Press, lifted: boolean): void {
  const { source, captor, pointerId } = press;
  press.listening.abort();
  press.ghost?.element.remove();
  if (source.lift) delete source.lift.dataset.lifted;
  delete document.documentElement.dataset.carrying;
  if (captor !== null && captor.hasPointerCapture(pointerId))
    captor.releasePointerCapture(pointerId);
  if (lifted) swallowStrayClick();
}

function follow({ ghost }: Press, at: CarryPoint): void {
  if (!ghost) return;
  const [x, y] = [at.x + ghost.offset.x, at.y + ghost.offset.y];
  ghost.element.style.transform = `translate(${x}px, ${y}px)`;
}

function perform(press: Press, effect: CarryEffect): void {
  switch (effect.kind) {
    case "lift":
      putUp(press, effect.from);
      break;
    case "follow":
      follow(press, effect.at);
      break;
    case "over": {
      const accepted = effect.target.over(effect.carried, effect.at);
      dispatch(press, { kind: "answer", target: effect.target, accepted });
      break;
    }
    case "leave":
      effect.target.leave();
      break;
    case "drop":
      effect.target.drop(effect.carried, effect.at);
      break;
    case "end":
      takeDown(press, effect.lifted);
      break;
  }
}

// The end comes last and runs even when an effect before it throws, such as a target's `drop`:
// the error still reaches the page, but the ghost, the hand and the listeners never outlive it.
function dispatch(press: Press, input: CarryInput): void {
  const [next, effects] = stepCarry(carry, input);
  carry = next;
  try {
    for (const effect of effects) if (effect.kind !== "end") perform(press, effect);
  } finally {
    for (const effect of effects) if (effect.kind === "end") perform(press, effect);
  }
}

// The page-wide listeners for one press, on the window's capture phase so nothing inside the
// page can hide the end of a carry from it. They go when the press ends.
function listen(press: Press): void {
  const options = { capture: true, signal: press.listening.signal };
  const cancel = (event: Event) => {
    if (event instanceof PointerEvent)
      dispatch(press, { kind: "pointercancel", pointerId: event.pointerId });
  };
  window.addEventListener(
    "pointermove",
    (event) => {
      const at = pointOf(event);
      dispatch(press, { kind: "move", pointerId: event.pointerId, at, target: targetAt(at) });
    },
    options,
  );
  window.addEventListener(
    "pointerup",
    (event) => {
      dispatch(press, { kind: "release", pointerId: event.pointerId, at: pointOf(event) });
    },
    options,
  );
  window.addEventListener("pointercancel", cancel, options);
  press.captor?.addEventListener("lostpointercapture", cancel, options);
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dispatch(press, { kind: "cancel" });
    },
    options,
  );
  // The window's own blur only: in the capture phase every element's blur would pass here too.
  window.addEventListener(
    "blur",
    () => {
      dispatch(press, { kind: "cancel" });
    },
    { signal: press.listening.signal },
  );
}

/**
 * Lets `element` and everything inside it take a carry, unless something nearer registers too.
 * Returns the function that stops it.
 */
export function acceptCarry(element: Element, target: CarryTarget): () => void {
  targets.set(element, target);
  return () => {
    if (targets.get(element) === target) targets.delete(element);
  };
}

/**
 * `acceptCarry` for the element in `ref` while it is mounted. The latest `target` answers, so
 * it may be a new object on every render.
 */
export function useCarryTarget(ref: RefObject<HTMLElement | null>, target: CarryTarget): void {
  const latest = useRef(target);
  useLayoutEffect(() => {
    latest.current = target;
  });
  useEffect(() => {
    const element = ref.current;
    return element
      ? acceptCarry(element, {
          over: (carried, at) => latest.current.over(carried, at),
          leave: () => {
            latest.current.leave();
          },
          drop: (carried, at) => {
            latest.current.drop(carried, at);
          },
        })
      : undefined;
  }, [ref]);
}

/**
 * Arms a carry from a primary-button press: past `LIFT_PX` it lifts, and the release drops it
 * on the target under the pointer. The press is claimed, so the browser starts no drag or
 * selection of its own, and the carry it arms is the page's one carry: a handle further out
 * that hears the same press, or any press while a carry is under way, arms nothing. The press
 * still reaches the rest of the page, so a menu open elsewhere hears it and closes.
 */
export function armCarry(down: CarryPress, source: CarrySource): void {
  if (down.button !== 0) return;
  const { pointerId } = down;
  const [next] = stepCarry(carry, {
    kind: "press",
    pointerId,
    at: pointOf(down),
    carried: source.carried,
  });
  if (next === carry) return;
  down.preventDefault();
  carry = next;
  listen({
    pointerId,
    source,
    captor: down.target instanceof Element ? down.target : null,
    listening: new AbortController(),
    ghost: null,
  });
}
