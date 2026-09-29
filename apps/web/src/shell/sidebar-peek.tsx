import { useSidebar } from "@yaklabs/ui/components/sidebar";
import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useSyncExternalStore,
  type Dispatch,
  type RefObject,
  type TransitionEvent,
} from "react";
import { useLocation } from "react-router";
import {
  isOut,
  nextPeek,
  peekIntent,
  RESTING,
  type PeekAction,
  type PeekIntent,
  type PeekPhase,
} from "./peek";

// A pointer that hovers: a peek on hover means nothing to a touch screen.
const FINE_HOVER = "(hover: hover) and (pointer: fine)";
// A slide back that never reports its end (a transition cut short) still settles by then.
const LEAVE_FALLBACK_MS = 400;
// The title bar's toggle; every place the pointer can rest for the sidebar to peek (the toggle,
// the strip just past the rail's edge, the rail or panel itself); and the rail's own buttons,
// which show their names in a pill instead.
const TOGGLE = 'header [data-sidebar="trigger"]';
const ZONES = `${TOGGLE}, [data-slot="sidebar-hot-zone"], [data-slot="sidebar-container"]`;
const RAIL_BUTTONS = '[data-slot="sidebar-container"] :is(a, button)';

/** The peek as the sidebar draws it. */
export type SidebarPeek = {
  phase: PeekPhase;
  /** The step into this phase is drawn with no motion. */
  instant: boolean;
  /** Whether the sidebar can peek at all: collapsed, on a desktop, under a hovering pointer. */
  enabled: boolean;
  onTransitionEnd: (event: TransitionEvent<HTMLDivElement>) => void;
};

function subscribeHover(onChange: () => void): () => void {
  const query = window.matchMedia(FINE_HOVER);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

function canHover(): boolean {
  return window.matchMedia(FINE_HOVER).matches;
}

// Whether the pointer is on a place that peeks: the toggle, the strip past the rail, the rail
// itself off its buttons, or anywhere on the panel while it is out.
function inPeekZone(target: EventTarget | null, out: boolean): boolean {
  if (!(target instanceof Element) || target.closest(ZONES) === null) return false;
  return out || target.closest(RAIL_BUTTONS) === null;
}

// Whether something in the panel keeps it out: keyboard focus, or a menu it opened (a menu's
// popup sits outside the panel, so the pointer leaving for it must not close the panel).
function isHeld(panel: HTMLElement | null): boolean {
  if (panel === null) return false;
  return (
    panel.querySelector(':focus-visible, [aria-haspopup="menu"][aria-expanded="true"]') !== null
  );
}

// Escape closes the peek, unless a menu has it: the menu closes itself first.
function escapes(event: KeyboardEvent): boolean {
  const inMenu = event.target instanceof Element && event.target.closest('[role="menu"]') !== null;
  return event.key === "Escape" && !event.defaultPrevented && !inMenu;
}

// Closes the peek on Escape; focus that was inside it goes to the toggle, since the rows it was
// on leave the page with the panel.
function closeOnEscape(intent: PeekIntent, panel: HTMLElement): void {
  const inside = panel.contains(document.activeElement);
  intent.close(true);
  if (inside) document.querySelector<HTMLElement>(TOGGLE)?.focus();
}

// Wires the page's pointer, keys and focus to the peek's timing while the sidebar can peek, and
// rests the peek as the rail whenever it cannot.
function usePeekIntent(
  enabled: boolean,
  panel: RefObject<HTMLDivElement | null>,
  phase: PeekPhase,
  dispatch: Dispatch<PeekAction>,
): RefObject<PeekIntent | null> {
  const current = useRef(phase);
  const intent = useRef<PeekIntent | null>(null);
  useLayoutEffect(() => {
    current.current = phase;
  }, [phase]);
  useEffect(() => {
    const element = panel.current;
    if (!enabled || element === null) {
      dispatch({ type: "rest" });
      return () => {};
    }
    const peek = peekIntent({
      phase: () => current.current,
      held: () => isHeld(element),
      dispatch,
    });
    intent.current = peek;
    const unlisten = listen(peek, element, () => isOut(current.current));
    return () => {
      unlisten();
      intent.current = null;
    };
  }, [enabled, panel, dispatch]);
  return intent;
}

// The listeners behind usePeekIntent; returns what removes them and stops the timing.
function listen(peek: PeekIntent, panel: HTMLElement, out: () => boolean): () => void {
  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== "touch") peek.point(inPeekZone(event.target, out()));
  };
  const onLeave = () => {
    peek.point(false);
  };
  const onDown = () => {
    peek.input(false);
  };
  const onKey = (event: KeyboardEvent) => {
    peek.input(true);
    if (out() && escapes(event)) closeOnEscape(peek, panel);
  };
  const onFocusOut = () => {
    setTimeout(peek.release);
  };
  const menus = new MutationObserver(peek.release);
  menus.observe(panel, { subtree: true, attributeFilter: ["aria-expanded"] });
  document.addEventListener("pointermove", onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("keydown", onKey);
  panel.addEventListener("focusout", onFocusOut);
  return () => {
    peek.dispose();
    menus.disconnect();
    document.removeEventListener("pointermove", onMove);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    document.removeEventListener("pointerdown", onDown, true);
    document.removeEventListener("keydown", onKey);
    panel.removeEventListener("focusout", onFocusOut);
  };
}

// Draws each step's start before the next: the slide's start (off to the left) before it
// slides, and a step with no motion before motion comes back. Reading the panel's box makes
// the browser compute its styles there and then, which is what a transition starts from.
function useSettle(
  panel: RefObject<HTMLDivElement | null>,
  { phase, instant }: { phase: PeekPhase; instant: boolean },
  dispatch: Dispatch<PeekAction>,
): void {
  useLayoutEffect(() => {
    if (phase !== "entering") return;
    panel.current?.getBoundingClientRect();
    dispatch({ type: "entered" });
  }, [panel, phase, dispatch]);
  useLayoutEffect(() => {
    if (!instant) return;
    panel.current?.getBoundingClientRect();
    dispatch({ type: "settled" });
  }, [panel, instant, dispatch]);
}

// Whether a transition that just ended on the panel was its last: the slide and the fade end
// together today (index.css), and neither may hand the panel to the rail while the other runs.
function lastToEnd(event: TransitionEvent<HTMLDivElement>): boolean {
  return event.target === event.currentTarget && event.currentTarget.getAnimations().length === 0;
}

// The slide back ends in the rail: once the panel's last transition ends, or by a fallback if
// that never comes.
function useLeave(phase: PeekPhase, dispatch: Dispatch<PeekAction>) {
  useEffect(() => {
    if (phase !== "leaving") return () => {};
    const fallback = setTimeout(() => {
      dispatch({ type: "left" });
    }, LEAVE_FALLBACK_MS);
    return () => {
      clearTimeout(fallback);
    };
  }, [phase, dispatch]);
  return (event: TransitionEvent<HTMLDivElement>) => {
    if (phase === "leaving" && lastToEnd(event)) dispatch({ type: "left" });
  };
}

// A visit somewhere new (a row, a place, a "+") closes the peek, at once when a key made it.
function useClosesOnArrival(intent: RefObject<PeekIntent | null>): void {
  const { key } = useLocation();
  const seen = useRef(key);
  useEffect(() => {
    if (seen.current === key) return;
    seen.current = key;
    intent.current?.arrive();
  }, [key, intent]);
}

/**
 * The sidebar's peek, for the sidebar whose container is `panel`: while it is
 * collapsed to its rail on a desktop, the whole sidebar slides out over the workspace once the
 * pointer rests on the title bar's toggle, on the rail off its buttons, or on the strip just
 * past it, and slides back 250ms after the pointer leaves them all. Keyboard focus inside it
 * or a menu it opened holds it out; Escape, a visit to a thread and pinning the sidebar close
 * it. A key's close is drawn with no motion.
 */
export function useSidebarPeek(panel: RefObject<HTMLDivElement | null>): SidebarPeek {
  const { state, isMobile } = useSidebar();
  const hovers = useSyncExternalStore(subscribeHover, canHover, () => false);
  const enabled = state === "collapsed" && !isMobile && hovers;
  const [peek, dispatch] = useReducer(nextPeek, RESTING);
  const intent = usePeekIntent(enabled, panel, peek.phase, dispatch);
  useSettle(panel, peek, dispatch);
  useClosesOnArrival(intent);
  const onTransitionEnd = useLeave(peek.phase, dispatch);
  return { ...peek, enabled, onTransitionEnd };
}

/**
 * What the sidebar takes from its peek: the phase to draw (none at rest), whether the step is
 * drawn with no motion, and the end of the slide back.
 */
export function peekProps(peek: SidebarPeek) {
  return {
    peek: peek.phase === "rail" ? undefined : peek.phase,
    "data-peek-instant": peek.instant || undefined,
    onTransitionEnd: peek.onTransitionEnd,
  };
}

/**
 * The strip just past the collapsed rail's edge (6px over the workspace) where the pointer can
 * rest for the sidebar to peek, as it can on the rail itself. It takes no clicks of its own.
 */
export function PeekHotZone() {
  return (
    <div
      data-slot="sidebar-hot-zone"
      aria-hidden="true"
      className="absolute inset-y-0 left-(--sidebar-width-icon) z-10 w-1.5"
    />
  );
}
