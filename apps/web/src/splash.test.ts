import { describe, expect, it } from "vitest";
import { SPLASH_LOOKS, lookForVisit, splashStyleOf } from "./splash";

describe("SPLASH_LOOKS", () => {
  it("lists the four looks in the switch's order, with Bonsai waiting for its assets", () => {
    expect(SPLASH_LOOKS.map((look) => [look.id, look.available])).toEqual([
      ["landscape", true],
      ["abstract", true],
      ["vitruvian", true],
      ["bonsai", false],
    ]);
  });
});

describe("splashStyleOf", () => {
  it("names each available look", () => {
    expect(splashStyleOf("landscape")).toBe("landscape");
    expect(splashStyleOf("abstract")).toBe("abstract");
    expect(splashStyleOf("vitruvian")).toBe("vitruvian");
  });

  it("does not name Bonsai until it has assets", () => {
    expect(splashStyleOf("bonsai")).toBeNull();
  });

  it("refuses anything else, such as a stale stored value or a bad address", () => {
    expect(splashStyleOf("sphere")).toBeNull();
    expect(splashStyleOf("")).toBeNull();
    expect(splashStyleOf(null)).toBeNull();
  });
});

describe("lookForVisit", () => {
  it("opens a first visit on the abstract painting", () => {
    expect(lookForVisit(null, false, 0.9)).toBe("abstract");
  });

  it("draws landscape or Vitruvian once a welcome has been seen", () => {
    expect(lookForVisit(null, true, 0)).toBe("landscape");
    expect(lookForVisit(null, true, 0.49)).toBe("landscape");
    expect(lookForVisit(null, true, 0.5)).toBe("vitruvian");
    expect(lookForVisit(null, true, 0.999)).toBe("vitruvian");
  });

  it("never draws the abstract painting again after the first visit", () => {
    const draws = Array.from({ length: 20 }, (_, i) => lookForVisit(null, true, i / 20));
    expect(new Set(draws)).toEqual(new Set(["landscape", "vitruvian"]));
  });

  it("lets the address choose, first visit or not", () => {
    expect(lookForVisit("vitruvian", false, 0)).toBe("vitruvian");
    expect(lookForVisit("abstract", true, 0.7)).toBe("abstract");
  });
});
