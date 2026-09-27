import { describe, expect, it } from "vitest";
import { centerScrollTop, nudgeScrollTop, type Viewport } from "./threadReveal";

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
