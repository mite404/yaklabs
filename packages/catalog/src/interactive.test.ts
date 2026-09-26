import { describe, expect, it } from "vitest";
import {
  attachmentLabel,
  fillSentence,
  formatUsd,
  niceCeiling,
  resolveInteractive,
  summarize,
  type InteractiveSelection,
} from "./interactive";
import { profitCard } from "./thread";

// A deep copy the test can break without touching the shared fixture.
function card(): InteractiveSelection {
  return structuredClone(profitCard) as InteractiveSelection;
}

describe("resolveInteractive", () => {
  it("approves the profit card", () => {
    expect(resolveInteractive(profitCard).kind).toBe("approved");
  });

  it("rejects a sentence with an invented placeholder", () => {
    const broken = card();
    broken.props.sentence = "{measure} beat {forecast}.";
    expect(resolveInteractive(broken).kind).toBe("rejected");
  });

  it("rejects any extra field, such as styling", () => {
    expect(
      resolveInteractive({ ...profitCard, props: { ...profitCard.props, color: "red" } }).kind,
    ).toBe("rejected");
  });

  it("rejects stops that do not cover the same rows", () => {
    const broken = card();
    broken.props.control.stops[2].rows = broken.props.control.stops[2].rows.slice(0, 6);
    expect(resolveInteractive(broken).kind).toBe("rejected");
  });

  it("rejects an initial stop that does not exist", () => {
    const broken = card();
    broken.props.control.initial = "revenue";
    expect(resolveInteractive(broken).kind).toBe("rejected");
  });
});

it("summarises a stop for the live sentence", () => {
  const [gross, , net] = card().props.control.stops;
  expect(summarize(gross, "Sep 14–20")).toMatchObject({
    measure: "Gross profit",
    total: "$57.2k",
    peakLabel: "Sat",
    peakValue: "$11.2k",
  });
  expect(summarize(net, "Sep 14–20").total).toBe("$25.6k");
});

it("fills the sentence and marks which parts are live", () => {
  const parts = fillSentence("{measure} was {total}.", {
    measure: "Net profit",
    total: "$25.6k",
    peakLabel: "Sat",
    peakValue: "$5.9k",
    period: "Sep 14–20",
  });
  expect(parts).toEqual([
    { text: "Net profit", live: true },
    { text: " was ", live: false },
    { text: "$25.6k", live: true },
    { text: ".", live: false },
  ]);
});

it("formats dollars compactly, without a meaningless .0", () => {
  expect(formatUsd(950)).toBe("$950");
  expect(formatUsd(9_000)).toBe("$9k");
  expect(formatUsd(57_200)).toBe("$57.2k");
  expect(formatUsd(-1_250_000)).toBe("-$1.3M");
});

it("labels the chip with the measure and period", () => {
  expect(attachmentLabel(card().props.control.stops[2], "Sep 14–20")).toBe(
    "Net profit · Sep 14–20",
  );
});

it("rounds axis maxima up to round numbers", () => {
  expect(niceCeiling(11_200)).toBe(12_000);
  expect(niceCeiling(57)).toBe(60);
  expect(niceCeiling(1_000)).toBe(1_000);
  expect(niceCeiling(0)).toBe(1);
});
