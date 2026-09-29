import { describe, expect, it } from "vitest";
import { SPLASH_LOOKS, splashStyleOf } from "./splash";

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
