import { describe, expect, it } from "vitest";
import { SPLASH_LOOKS, lookForVisit, splashStyleOf } from "./splash";

describe("SPLASH_LOOKS", () => {
  it("lists the three looks in the switch's order, abstract first", () => {
    expect(SPLASH_LOOKS.map((look) => look.id)).toEqual(["abstract", "landscape", "vitruvian"]);
  });
});

describe("splashStyleOf", () => {
  it("names each look", () => {
    expect(splashStyleOf("landscape")).toBe("landscape");
    expect(splashStyleOf("abstract")).toBe("abstract");
    expect(splashStyleOf("vitruvian")).toBe("vitruvian");
  });

  it("refuses anything else, such as a stale stored value or a bad address", () => {
    expect(splashStyleOf("bonsai")).toBeNull();
    expect(splashStyleOf("sphere")).toBeNull();
    expect(splashStyleOf("")).toBeNull();
    expect(splashStyleOf(null)).toBeNull();
  });
});

describe("lookForVisit", () => {
  it("cycles abstract, landscape, Vitruvian, visit by visit, then round again", () => {
    expect([0, 1, 2, 3, 4].map((turn) => lookForVisit(null, turn))).toEqual([
      "abstract",
      "landscape",
      "vitruvian",
      "abstract",
      "landscape",
    ]);
  });

  it("starts the cycle over for a turn storage could not keep", () => {
    expect(lookForVisit(null, Number.NaN)).toBe("abstract");
    expect(lookForVisit(null, 1.5)).toBe("abstract");
    expect(lookForVisit(null, -1)).toBe("vitruvian");
  });

  it("lets the address choose, wherever the cycle stands", () => {
    expect(lookForVisit("vitruvian", 0)).toBe("vitruvian");
    expect(lookForVisit("abstract", 2)).toBe("abstract");
  });
});
