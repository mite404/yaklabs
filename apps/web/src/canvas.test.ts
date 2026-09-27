import { describe, expect, it } from "vitest";
import { landingIndex, shiftFor, slotLeft } from "./canvas";

// Three lanes 200 wide with a 16 gap: centres at 100, 316 and 532.
const slots = [
  { left: 0, width: 200 },
  { left: 216, width: 200 },
  { left: 432, width: 200 },
];

describe("landingIndex", () => {
  it("stays put until the dragged centre crosses a neighbour's", () => {
    expect(landingIndex(slots, 0, 215)).toBe(0);
    expect(landingIndex(slots, 0, 217)).toBe(1);
    expect(landingIndex(slots, 0, 433)).toBe(2);
  });
  it("moves left the same way", () => {
    expect(landingIndex(slots, 2, -215)).toBe(2);
    expect(landingIndex(slots, 2, -217)).toBe(1);
    expect(landingIndex(slots, 2, -433)).toBe(0);
  });
});

describe("shiftFor and slotLeft", () => {
  it("steps the lanes between aside by the moving lane's room, and lands in the space", () => {
    expect([0, 1, 2].map((i) => shiftFor(slots, 0, 2, i, 16))).toEqual([0, -216, -216]);
    expect([0, 1, 2].map((i) => shiftFor(slots, 2, 0, i, 16))).toEqual([216, 216, 0]);
    expect([0, 1, 2].map((i) => shiftFor(slots, 1, 1, i, 16))).toEqual([0, 0, 0]);
    expect(slotLeft(slots, 0, 2)).toBe(432);
    expect(slotLeft(slots, 2, 0)).toBe(0);
  });
});
