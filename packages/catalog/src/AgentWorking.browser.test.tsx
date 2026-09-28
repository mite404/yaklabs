import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentWorking } from "./AgentWorking";
import "./tokens.css";

type Offset = { x: number; y: number };

let host: HTMLElement;
let root: Root;

function glyph(): HTMLElement {
  const found = host.querySelector<HTMLElement>(".agent-working");
  if (!found) throw new Error("no agent working glyph rendered");
  return found;
}

// Every square's animation start time; a CSS animation's is a number of ms once it runs.
function startTimes(): unknown[] {
  return glyph()
    .getAnimations({ subtree: true })
    .map((animation) => animation.startTime);
}

// Where each square sits, in CSS pixels from the glyph's own corner.
function cellOffsets(): Offset[] {
  const box = glyph().getBoundingClientRect();
  return [...glyph().querySelectorAll(".agent-working-cell")].map((cell) => {
    const rect = cell.getBoundingClientRect();
    return { x: rect.x - box.x, y: rect.y - box.y };
  });
}

// Distances between the distinct values, in reading order, which is also top-to-bottom and
// left-to-right: [0, 4, 0, 4] → [4].
function steps(values: number[]): number[] {
  const distinct = [...new Set(values)];
  return distinct.slice(1).map((value, i) => value - (distinct[i] ?? value));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  root.unmount();
  host.remove();
});

describe("AgentWorking", () => {
  it("keeps every square on one clock when the cell count changes mid-loop", async () => {
    flushSync(() => {
      root.render(<AgentWorking />);
    });
    await wait(200);
    flushSync(() => {
      root.render(<AgentWorking cells={6} />);
    });
    await wait(50);

    const starts = startTimes(); // → six start times
    expect(starts).toHaveLength(6);
    expect(new Set(starts).size).toBe(1);
  });

  it("puts all six squares on whole pixels with even gaps", () => {
    flushSync(() => {
      root.render(<AgentWorking cells={6} />);
    });

    const offsets = cellOffsets(); // → [{ x, y }] in reading order
    const coordinates = offsets.flatMap(({ x, y }) => [x, y]); // → number[]
    expect(coordinates.every((value) => Number.isInteger(value))).toBe(true);
    const columnSteps = steps(offsets.map(({ x }) => x)); // → one step between two columns
    const rowSteps = steps(offsets.map(({ y }) => y)); // → two steps between three rows
    expect(columnSteps).toHaveLength(1);
    expect(rowSteps).toHaveLength(2);
    expect(new Set([...columnSteps, ...rowSteps]).size).toBe(1);
  });
});
