import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { AgentTree } from "./AgentTree";
import "./tokens.css";

type Box = { x: number; y: number; width: number; height: number };

let host: HTMLElement;
let root: Root;

// Each pill's box, in CSS pixels from the glyph's own corner, top to bottom.
function pillBoxes(): Box[] {
  const glyph = host.querySelector(".agent-tree");
  if (!glyph) throw new Error("no agent tree rendered");
  const origin = glyph.getBoundingClientRect();
  return [...glyph.querySelectorAll(".agent-tree-pill")].map((pill) => {
    const { x, y, width, height } = pill.getBoundingClientRect();
    return { x: x - origin.x, y: y - origin.y, width, height };
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

it("draws Kay's three pills on whole pixels: left branch, right branch, full base", () => {
  flushSync(() => {
    root.render(<AgentTree />);
  });

  expect(pillBoxes()).toEqual([
    { x: 2, y: 1, width: 7, height: 3 },
    { x: 5, y: 5, width: 7, height: 3 },
    { x: 0, y: 9, width: 12, height: 3 },
  ]);
});
