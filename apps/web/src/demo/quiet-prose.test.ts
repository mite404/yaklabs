import { describe, expect, it } from "vitest";
import {
  code,
  countWords,
  em,
  heading,
  link,
  list,
  paragraph,
  revealBlocks,
  strong,
  text,
} from "./quiet-prose";

const SAMPLE = [
  heading([text("Monday brief")]),
  paragraph([text("The backlog fell from"), strong("46 to 18"), text("this week.")]),
  list([
    [text("Billing"), text("12 open")],
    [text("Product"), text("4 open")],
  ]),
];

describe("countWords", () => {
  it("counts every word across paragraphs, headings and list items", () => {
    // "Monday brief" (2) + "The backlog fell from" (4) + "46 to 18" (3) + "this week." (2)
    // + "Billing 12 open" (3) + "Product 4 open" (3) = 17
    expect(countWords(SAMPLE)).toBe(17);
  });

  it("counts a code segment as one word, never split", () => {
    expect(countWords([paragraph([code("git status --short")])])).toBe(1);
  });
});

describe("revealBlocks", () => {
  it("reveals nothing at a zero or negative budget", () => {
    expect(revealBlocks(SAMPLE, 0)).toEqual([]);
    expect(revealBlocks(SAMPLE, -5)).toEqual([]);
  });

  it("reveals every block once the budget covers the whole word count", () => {
    expect(revealBlocks(SAMPLE, countWords(SAMPLE))).toEqual(SAMPLE);
    expect(revealBlocks(SAMPLE, 1000)).toEqual(SAMPLE);
  });

  it("truncates mid-segment, keeping only the words the budget allows", () => {
    const revealed = revealBlocks(SAMPLE, 2);
    expect(revealed).toEqual([heading([text("Monday brief")])]);
  });

  it("truncates the segment straddling the budget, dropping later ones on that block", () => {
    // Heading (2) + "The backlog fell from" (4) = 6, budget 7 reaches one word into the next
    // strong segment ("46 to 18" -> "46").
    const revealed = revealBlocks(SAMPLE, 7);
    expect(revealed).toEqual([
      heading([text("Monday brief")]),
      paragraph([text("The backlog fell from"), strong("46")]),
    ]);
  });

  it("drops a code segment entirely rather than reveal part of it", () => {
    const blocks = [paragraph([text("Run"), code("git status --short"), text("first.")])];
    // "Run" (1) + code (1 unit) = budget 1 stops right at "Run", before the code segment starts.
    expect(revealBlocks(blocks, 1)).toEqual([paragraph([text("Run")])]);
  });

  it("reveals list items in order, dropping an item the budget never reaches", () => {
    // Heading (2) + paragraph (4+3+2=9) = 11; +3 for the first list item = 14 reveals it whole,
    // leaving nothing for the second.
    const revealed = revealBlocks(SAMPLE, 14);
    expect(revealed).toEqual([
      heading([text("Monday brief")]),
      paragraph([text("The backlog fell from"), strong("46 to 18"), text("this week.")]),
      list([[text("Billing"), text("12 open")]]),
    ]);
  });

  it("never mutates the source blocks", () => {
    const before = JSON.stringify(SAMPLE);
    revealBlocks(SAMPLE, 3);
    expect(JSON.stringify(SAMPLE)).toBe(before);
  });

  it("keeps a link's href intact even when its text is truncated", () => {
    const blocks = [paragraph([link("read the policy", "/policy")])];
    expect(revealBlocks(blocks, 1)).toEqual([
      paragraph([{ kind: "link", text: "read", href: "/policy" }]),
    ]);
  });

  it("keeps emphasis and strong tags distinct through a partial reveal", () => {
    const blocks = [paragraph([em("quiet"), strong("prose")])];
    expect(revealBlocks(blocks, 1)).toEqual([paragraph([em("quiet")])]);
  });

  it("keeps the exact original whitespace inside a partially revealed segment", () => {
    // "Answer:" (1) + "two" (1) = budget 2 stops inside a segment with double spaces both
    // before and between its words; a naive words.join(" ") rebuild would collapse them.
    const blocks = [paragraph([text("Answer:  two  spaces  indeed")])];
    expect(revealBlocks(blocks, 2)).toEqual([paragraph([text("Answer:  two")])]);
  });

  it("keeps a segment's own leading whitespace when it is the one truncated", () => {
    // The first segment is fully taken (1 word), leaving budget 1 for the second segment,
    // which starts with a space before its first word.
    const blocks = [paragraph([text("Start"), text("  and then more")])];
    expect(revealBlocks(blocks, 2)).toEqual([paragraph([text("Start"), text("  and")])]);
  });
});
