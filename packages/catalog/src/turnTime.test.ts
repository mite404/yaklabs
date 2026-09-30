import { describe, expect, it } from "vitest";
import { instantOf, relativeStamp, stampOf, timeLabel } from "./turnTime";

const AT = Date.UTC(2026, 8, 30, 9, 0);
const MINUTE = 60_000;

describe("relativeStamp", () => {
  it("reads just now for the first twenty minutes, a future instant included", () => {
    expect(relativeStamp(AT, AT)).toBe("just now");
    expect(relativeStamp(AT, AT + 19 * MINUTE)).toBe("just now");
    expect(relativeStamp(AT, AT - MINUTE)).toBe("just now");
  });

  it("then moves in twenty-minute steps", () => {
    expect(relativeStamp(AT, AT + 20 * MINUTE)).toBe("20m ago");
    expect(relativeStamp(AT, AT + 39 * MINUTE)).toBe("20m ago");
    expect(relativeStamp(AT, AT + 40 * MINUTE)).toBe("40m ago");
    expect(relativeStamp(AT, AT + 60 * MINUTE)).toBe("1h ago");
    expect(relativeStamp(AT, AT + 85 * MINUTE)).toBe("1h 20m ago");
    expect(relativeStamp(AT, AT + 26 * 60 * MINUTE)).toBe("26h ago");
  });
});

describe("instantOf and stampOf", () => {
  it("reads an ISO time and leaves a clock reading alone", () => {
    expect(instantOf("2026-09-30T09:00:00.000Z")).toBe(AT);
    expect(instantOf("9:02")).toBeUndefined();
    expect(instantOf("now")).toBeUndefined();
    expect(stampOf("2026-09-30T09:00:00.000Z", AT + 45 * MINUTE)).toBe("40m ago");
    expect(stampOf("9:02", AT)).toBe("9:02");
  });

  it("labels a list with a clock reading whichever form the time was kept in", () => {
    expect(timeLabel("9:02")).toBe("9:02");
    expect(timeLabel("2026-09-30T09:07:00.000Z")).toMatch(/\d{1,2}:07/u);
  });
});
