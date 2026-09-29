import { resolve } from "@yaklabs/catalog/catalog";
import { describe, expect, it } from "vitest";
import { countWords } from "./quiet-prose";
import { draftBlocks, findingBlocks, issuesChart, workloadChart } from "./content";

describe("the fixture data", () => {
  it("has the backlog fall from 46 Monday to 18 Friday, weekdays only", () => {
    expect(workloadChart.props.rows).toEqual([
      { label: "Mon", value: 46 },
      { label: "Tue", value: 39 },
      { label: "Wed", value: 31 },
      { label: "Thu", value: 24 },
      { label: "Fri", value: 18 },
    ]);
    expect(workloadChart.props.rows.map((row) => row.label)).not.toContain("Sat");
    expect(workloadChart.props.rows.map((row) => row.label)).not.toContain("Sun");
  });

  it("has Friday's open categories sum to the same 18 the workload chart ends on", () => {
    const total = issuesChart.props.rows.reduce((sum, row) => sum + (row.value ?? 0), 0);
    expect(total).toBe(18);
    expect(issuesChart.props.rows).toEqual([
      { label: "Billing", value: 12 },
      { label: "Product", value: 4 },
      { label: "Access", value: 2 },
    ]);
  });

  it("passes catalog validation as an approved chart, never a rejected or fallback one", () => {
    expect(resolve(workloadChart).kind).toBe("approved");
    expect(resolve(issuesChart).kind).toBe("approved");
  });
});

describe("findingBlocks", () => {
  it("carries both semantic emphasis and strong markup", () => {
    const kinds = new Set(
      findingBlocks.flatMap((block) =>
        block.kind === "list" ? [] : block.content.map((s) => s.kind),
      ),
    );
    expect(kinds.has("strong")).toBe(true);
    expect(kinds.has("em")).toBe(true);
  });

  it("has a nonzero word count to stream", () => {
    expect(countWords(findingBlocks)).toBeGreaterThan(10);
  });
});

describe("draftBlocks", () => {
  it("orders billing first by open count, largest first", () => {
    const blocks = draftBlocks({ kind: "billing" });
    const listBlock = blocks.find((block) => block.kind === "list");
    expect(listBlock?.kind).toBe("list");
    if (listBlock?.kind !== "list") throw new Error("unreachable");
    const names = listBlock.items.map((item) => item[0].text);
    expect(names).toEqual(["Billing", "Product", "Access"]);
  });

  it("orders oldest first by median age, oldest first, differently from billing first", () => {
    const oldestList = draftBlocks({ kind: "oldest" }).find((block) => block.kind === "list");
    const billingList = draftBlocks({ kind: "billing" }).find((block) => block.kind === "list");
    if (oldestList?.kind !== "list" || billingList?.kind !== "list") throw new Error("unreachable");
    const oldestNames = oldestList.items.map((item) => item[0].text);
    const billingNames = billingList.items.map((item) => item[0].text);
    expect(oldestNames).toEqual(["Access", "Product", "Billing"]);
    expect(oldestNames).not.toEqual(billingNames);
  });

  it("echoes a typed choice verbatim instead of pretending to understand it", () => {
    const blocks = draftBlocks({ kind: "typed", text: "close whatever is oldest, skip billing" });
    const lead = blocks[1];
    const flattened = lead.kind === "list" ? "" : lead.content.map((s) => s.text).join("");
    expect(flattened).toContain("close whatever is oldest, skip billing");
  });

  it("ends with the exact ready phrase, on its own, for every choice", () => {
    for (const choice of [
      { kind: "billing" as const },
      { kind: "oldest" as const },
      { kind: "typed" as const, text: "x" },
    ]) {
      const blocks = draftBlocks(choice);
      const last = blocks.at(-1);
      expect(last?.kind).toBe("paragraph");
      if (last?.kind !== "paragraph") throw new Error("unreachable");
      expect(last.content).toEqual([{ kind: "text", text: "Your draft is ready." }]);
    }
  });

  it("never mentions the draft being ready anywhere but that final line", () => {
    for (const choice of [{ kind: "billing" as const }, { kind: "oldest" as const }]) {
      const blocks = draftBlocks(choice);
      const withoutLast = blocks.slice(0, -1);
      const flattened = JSON.stringify(withoutLast);
      expect(flattened.toLowerCase()).not.toContain("draft is ready");
    }
  });
});
