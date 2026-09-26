import { describe, expect, it } from "vitest";
import { pointInBoxes } from "./grabbable";

const line = { left: 100, right: 300, top: 40, bottom: 60 };
const nextLine = { left: 100, right: 180, top: 62, bottom: 82 };

describe("pointInBoxes", () => {
  it("finds a point on either line of a highlight", () => {
    expect(pointInBoxes([line, nextLine], 150, 50)).toBe(true);
    expect(pointInBoxes([line, nextLine], 150, 70)).toBe(true);
  });
  it("misses a point beside the highlight, but forgives the edge by two pixels", () => {
    expect(pointInBoxes([line, nextLine], 250, 70)).toBe(false);
    expect(pointInBoxes([line], 302, 50)).toBe(true);
    expect(pointInBoxes([line], 303, 50)).toBe(false);
  });
  it("finds nothing when there is no highlight", () => {
    expect(pointInBoxes([], 150, 50)).toBe(false);
  });
});
