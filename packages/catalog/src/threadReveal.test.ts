import { describe, expect, it } from "vitest";
import { centerScrollTop, nudgeScrollTop, pinnedAfterScroll, type Viewport } from "./threadReveal";

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

describe("pinnedAfterScroll", () => {
  it("pins a thread that reaches its end", () => {
    expect(pinnedAfterScroll(false, 492, { reach: 492, scrollTop: 492 })).toBe(true);
  });

  it("unpins a reader who scrolls up", () => {
    expect(pinnedAfterScroll(true, 492, { reach: 492, scrollTop: 300 })).toBe(false);
  });

  it("keeps the pin when the browser shifts the scroll as content above grows", () => {
    // Scroll anchoring moved scrollTop 463 → 490 while the reach grew to 492: the layout's
    // scroll, 2px short of the end, which the next resize pins back.
    expect(pinnedAfterScroll(true, 463, { reach: 492, scrollTop: 490 })).toBe(true);
  });

  it("unpins a reader who scrolls up in the same frame a streaming reply grows", () => {
    // The wheel moved scrollTop 463 → 300 as a chunk grew the reach to 492: the scroll event
    // arrives before the resize, so it sees both.
    expect(pinnedAfterScroll(true, 463, { reach: 492, scrollTop: 300 })).toBe(false);
  });

  it("leaves a reader who scrolled up where they are as content grows", () => {
    expect(pinnedAfterScroll(false, 463, { reach: 492, scrollTop: 300 })).toBe(false);
  });
});
