import { describe, expect, it } from "vitest";
import { lineItems } from "./WorkDetails";

describe("lineItems", () => {
  it("keys a repeated line apart from its twin, so both stay on the page", () => {
    const items = lineItems(["Mon 4", "Mon 4", "Tue 7"]);
    expect(new Set(items.map((item) => item.key)).size).toBe(3);
  });
});
