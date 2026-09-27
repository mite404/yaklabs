import { describe, expect, it } from "vitest";
import { centerScrollTop, nudgeScrollTop, restedAtEnd, type Viewport } from "./threadReveal";

// A 600px thread scrolled to 400, with the thread's 20px padding at both ends.
const view: Viewport = {
  scrollTop: 400,
  height: 600,
  insetTop: 20,
  insetBottom: 20,
  maxScrollTop: 5000,
};

describe("nudgeScrollTop", () => {
  it("leaves a card alone when nothing is clipped", () => {
    expect(nudgeScrollTop({ top: 500, bottom: 900 }, view)).toBe(400);
  });

  it("rests a clipped card's bottom 20px above the compose box, like the thread's last card", () => {
    // The band ends at 400 + 600 - 20 = 980; a card ending at 1011 rises by 31px.
    expect(nudgeScrollTop({ top: 600, bottom: 1011 }, view)).toBe(431);
  });

  it("measures the gap from the dock when a card floats above the compose box", () => {
    expect(nudgeScrollTop({ top: 800, bottom: 1011 }, { ...view, insetBottom: 220 })).toBe(631);
  });

  it("shows a card taller than the band down to its bottom edge, so nothing is left hidden", () => {
    // Its bottom rests 20px above the compose box (1700 - 600 + 20); its top leaves the view.
    expect(nudgeScrollTop({ top: 700, bottom: 1700 }, view)).toBe(1120);
  });

  it("never scrolls up to reveal, which would move away from the click", () => {
    expect(nudgeScrollTop({ top: 100, bottom: 950 }, view)).toBe(400);
  });

  it("never scrolls past the end of the thread", () => {
    expect(nudgeScrollTop({ top: 600, bottom: 1011 }, { ...view, maxScrollTop: 420 })).toBe(420);
  });
});

describe("centerScrollTop", () => {
  it("centers a jumped-to turn in the visible band", () => {
    // A 200px turn at 1000 in a 560px band sits 180px below the band's top.
    expect(centerScrollTop({ top: 1000, bottom: 1200 }, view)).toBe(800);
  });

  it("starts a turn taller than the band at the band's top", () => {
    expect(centerScrollTop({ top: 1000, bottom: 1700 }, view)).toBe(980);
  });

  it("never scrolls above the start of the thread", () => {
    expect(centerScrollTop({ top: 40, bottom: 140 }, view)).toBe(0);
  });
});

describe("restedAtEnd", () => {
  it("follows a thread that rested at its end as a turn grows", () => {
    // A chunk grew the last turn 29px: the reach went 463 → 492, the scroll stayed at 463.
    expect(restedAtEnd({ reach: 492, scrollTop: 463 }, 29)).toBe(true);
  });

  it("follows a thread a rounding pixel short of its end", () => {
    expect(restedAtEnd({ reach: 492, scrollTop: 462 }, 29)).toBe(true);
  });

  it("leaves a thread that rested 2px short of its end", () => {
    expect(restedAtEnd({ reach: 492, scrollTop: 461 }, 29)).toBe(false);
  });

  it("unpins a reader who scrolls up in the same frame a streaming reply grows", () => {
    // The wheel moved scrollTop 463 → 300 as a chunk grew the reach to 492: the resize sees
    // both, and only 29px of the 192px gap is the chunk's.
    expect(restedAtEnd({ reach: 492, scrollTop: 300 }, 29)).toBe(false);
  });

  it("follows a thread the browser clamped to its end as a turn above shrank", () => {
    // One turn shrank 20px and another grew 4px: the reach fell 433 → 417, clamping the scroll.
    expect(restedAtEnd({ reach: 417, scrollTop: 417 }, 4)).toBe(true);
  });

  it("follows a thread whose view got shorter as the compose box grew", () => {
    // The view lost 24px, so the reach went 463 → 487 with the scroll still at 463.
    expect(restedAtEnd({ reach: 487, scrollTop: 463 }, 24)).toBe(true);
  });
});
