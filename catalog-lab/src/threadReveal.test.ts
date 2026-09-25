import { describe, expect, it } from "vitest";
import { revealScrollTop } from "./threadReveal";

describe("revealScrollTop", () => {
  it("centers a target that fits in the visible band", () => {
    // A 200px target at 1000px in a 600px band sits 200px below the band's top.
    expect(
      revealScrollTop({ target: { top: 1000, bottom: 1200 }, viewHeight: 600, maxScrollTop: 5000 }),
    ).toBe(800);
  });

  it("starts a target taller than the band at the band's top, with a margin", () => {
    expect(
      revealScrollTop({ target: { top: 1000, bottom: 1700 }, viewHeight: 600, maxScrollTop: 5000 }),
    ).toBe(980);
  });

  it("never scrolls past the end of the thread: a last card sits flush above the compose box", () => {
    expect(
      revealScrollTop({ target: { top: 1000, bottom: 1200 }, viewHeight: 600, maxScrollTop: 700 }),
    ).toBe(700);
  });

  it("never scrolls above the start of the thread", () => {
    expect(
      revealScrollTop({ target: { top: 40, bottom: 140 }, viewHeight: 600, maxScrollTop: 700 }),
    ).toBe(0);
  });
});
