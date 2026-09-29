import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  nextPeek,
  PEEK_CLOSE_MS,
  PEEK_OPEN_MS,
  peekIntent,
  RESTING,
  type PeekAction,
  type PeekPhase,
  type PeekState,
} from "./peek";

const at = (phase: PeekPhase, instant = false): PeekState => ({ phase, instant });

describe("nextPeek", () => {
  it("slides out from the rail, and is out once its start is drawn", () => {
    const entering = nextPeek(RESTING, { type: "show" });
    expect(entering).toEqual(at("entering"));
    expect(nextPeek(entering, { type: "entered" })).toEqual(at("open"));
  });

  it("turns back out from partway home", () => {
    expect(nextPeek(at("leaving"), { type: "show" })).toEqual(at("open"));
  });

  it("slides back when hidden, and becomes the rail at once when it ends", () => {
    const leaving = nextPeek(at("open"), { type: "hide", instant: false });
    expect(leaving).toEqual(at("leaving"));
    expect(nextPeek(leaving, { type: "left" })).toEqual(at("rail", true));
  });

  it("goes straight to the rail, with no motion, when a key hides it", () => {
    expect(nextPeek(at("open"), { type: "hide", instant: true })).toEqual(at("rail", true));
    expect(nextPeek(at("leaving"), { type: "hide", instant: true })).toEqual(at("rail", true));
  });

  it("settles a step with no motion once it is drawn", () => {
    expect(nextPeek(at("rail", true), { type: "settled" })).toEqual(RESTING);
  });

  it("rests as the rail when the sidebar is pinned open, from any phase", () => {
    for (const phase of ["entering", "open", "leaving"] as const) {
      expect(nextPeek(at(phase), { type: "rest" })).toEqual(RESTING);
    }
    expect(nextPeek(RESTING, { type: "rest" })).toBe(RESTING);
  });

  it("ignores an action that does not apply to the phase", () => {
    const cases: [PeekState, PeekAction][] = [
      [at("open"), { type: "show" }],
      [at("entering"), { type: "show" }],
      [RESTING, { type: "hide", instant: false }],
      [at("leaving"), { type: "hide", instant: false }],
      [at("open"), { type: "entered" }],
      [at("open"), { type: "left" }],
      [RESTING, { type: "settled" }],
    ];
    for (const [state, action] of cases) expect(nextPeek(state, action)).toBe(state);
  });
});

// The timing under test, with the phase, the hold and every action it dispatched in view.
let phase: PeekPhase;
let held: boolean;
let actions: PeekAction[];
const intent = () =>
  peekIntent({
    phase: () => phase,
    held: () => held,
    dispatch: (action) => {
      actions.push(action);
    },
  });

beforeEach(() => {
  vi.useFakeTimers();
  phase = "rail";
  held = false;
  actions = [];
});
afterEach(() => {
  vi.useRealTimers();
});

describe("peekIntent, opening", () => {
  it("opens once the pointer has rested on a place that peeks", () => {
    const peek = intent();
    peek.point(false);
    peek.point(true);
    vi.advanceTimersByTime(PEEK_OPEN_MS - 1);
    expect(actions).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(actions).toEqual([{ type: "show" }]);
  });

  it("never opens for a pointer passing through", () => {
    const peek = intent();
    peek.point(false);
    peek.point(true);
    vi.advanceTimersByTime(PEEK_OPEN_MS / 2);
    peek.point(false);
    vi.advanceTimersByTime(PEEK_OPEN_MS * 4);
    expect(actions).toEqual([]);
  });

  it("waits for the pointer to leave before it first peeks", () => {
    const peek = intent();
    peek.point(true);
    vi.advanceTimersByTime(PEEK_OPEN_MS * 4);
    expect(actions).toEqual([]);
    peek.point(false);
    peek.point(true);
    vi.advanceTimersByTime(PEEK_OPEN_MS);
    expect(actions).toEqual([{ type: "show" }]);
  });

  it("turns back out at once when the pointer returns while it slides home", () => {
    const peek = intent();
    peek.point(false);
    phase = "leaving";
    peek.point(true);
    expect(actions).toEqual([{ type: "show" }]);
  });
});

describe("peekIntent, closing", () => {
  it("closes after the grace, and not if the pointer comes back", () => {
    const peek = intent();
    phase = "open";
    peek.point(true);
    peek.point(false);
    vi.advanceTimersByTime(PEEK_CLOSE_MS - 1);
    peek.point(true);
    vi.advanceTimersByTime(PEEK_CLOSE_MS * 2);
    expect(actions).toEqual([]);
    peek.point(false);
    vi.advanceTimersByTime(PEEK_CLOSE_MS);
    expect(actions).toEqual([{ type: "hide", instant: false }]);
  });

  it("stays out while held, and closes after the grace once let go", () => {
    const peek = intent();
    phase = "open";
    held = true;
    peek.point(true);
    peek.point(false);
    vi.advanceTimersByTime(PEEK_CLOSE_MS * 4);
    expect(actions).toEqual([]);
    held = false;
    peek.release();
    vi.advanceTimersByTime(PEEK_CLOSE_MS);
    expect(actions).toEqual([{ type: "hide", instant: false }]);
  });
});

describe("peekIntent, closing on a key or a visit", () => {
  it("closes with no motion on a key, and waits for the pointer to leave to peek again", () => {
    const peek = intent();
    phase = "open";
    peek.point(true);
    peek.close(true);
    expect(actions).toEqual([{ type: "hide", instant: true }]);
    phase = "rail";
    peek.point(false);
    peek.point(true);
    vi.advanceTimersByTime(PEEK_OPEN_MS);
    expect(actions.at(-1)).toEqual({ type: "show" });
  });

  it("closes on arrival as the last input would", () => {
    const peek = intent();
    phase = "open";
    peek.input(false);
    peek.arrive();
    peek.input(true);
    peek.arrive();
    expect(actions).toEqual([
      { type: "hide", instant: false },
      { type: "hide", instant: true },
    ]);
  });

  it("does nothing on arrival while resting as the rail", () => {
    const peek = intent();
    peek.arrive();
    expect(actions).toEqual([]);
  });
});
