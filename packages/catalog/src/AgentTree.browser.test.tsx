import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { AgentTree } from "./AgentTree";
import "./tokens.css";

type Box = { x: number; y: number; width: number; height: number };
type BaseFrame = { top: number; opacity: number };
type ScrollFrame = { baseTop: number; branchTop: number; branchOpacity: number };

let host: HTMLElement;
let root: Root;

function glyph(): HTMLElement {
  const found = host.querySelector<HTMLElement>(".agent-tree");
  if (!found) throw new Error("no agent tree rendered");
  return found;
}

function pills(): HTMLElement[] {
  return [...glyph().querySelectorAll<HTMLElement>(".agent-tree-pill")];
}

// Holds every pill's animation at one moment of the loop.
function seek(ms: number): void {
  for (const animation of glyph().getAnimations({ subtree: true })) {
    animation.pause();
    animation.currentTime = ms;
  }
}

// Each pill's box, in CSS pixels from the glyph's own corner, top to bottom.
function pillBoxes(): Box[] {
  const origin = glyph().getBoundingClientRect();
  return pills().map((pill) => {
    const { x, y, width, height } = pill.getBoundingClientRect();
    return { x: x - origin.x, y: y - origin.y, width, height };
  });
}

// Where the base sits and how visible it is at one moment of the loop.
function baseAt(ms: number): BaseFrame {
  seek(ms);
  const base = pills().at(2);
  if (!base) throw new Error("no base pill");
  const top = base.getBoundingClientRect().y - glyph().getBoundingClientRect().y;
  return { top, opacity: Number(getComputedStyle(base).opacity) };
}

// Where the base and the top branch sit, and how visible the branch is, at one moment of the
// scroll.
function scrollAt(ms: number): ScrollFrame {
  const { top } = baseAt(ms);
  const branch = pills().at(0);
  if (!branch) throw new Error("no top branch");
  return {
    baseTop: top,
    branchTop: branch.getBoundingClientRect().y - glyph().getBoundingClientRect().y,
    branchOpacity: Number(getComputedStyle(branch).opacity),
  };
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
  seek(600); // 30% in: the scroll is over and every pill is home

  expect(pillBoxes()).toEqual([
    { x: 2, y: 1, width: 7, height: 3 },
    { x: 5, y: 5, width: 7, height: 3 },
    { x: 0, y: 9, width: 12, height: 3 },
  ]);
});

it("scrolls the base fully under the bottom edge, and brings it home before it shows again", () => {
  flushSync(() => {
    root.render(<AgentTree duration={1000} />);
  });

  expect(baseAt(0)).toEqual({ top: 9, opacity: 1 }); // home, solid: the beat's last frame
  expect(baseAt(240)).toEqual({ top: 13, opacity: 1 }); // past the 12px edge, still solid
  expect(baseAt(300)).toEqual({ top: 9, opacity: 0 }); // home again, clear
  expect(baseAt(900)).toEqual({ top: 9, opacity: 1 }); // faded back in for the beat
});

it("scrolls the top branch in from above as the base scrolls out, as one strip", () => {
  flushSync(() => {
    root.render(<AgentTree duration={1000} />);
  });

  // before the move: the branch waits clear, fully above the top edge
  expect(scrollAt(0)).toEqual({ baseTop: 9, branchTop: -3, branchOpacity: 0 });
  const half = scrollAt(120); // → the halfway frame of the scroll
  expect(half.baseTop).toBeCloseTo(11); // both 2px down: one strip moving
  expect(half.branchTop).toBeCloseTo(-1);
  expect(half.branchOpacity).toBeCloseTo(0.5); // half faded up
  // the base is past the bottom edge as the branch lands home, solid
  expect(scrollAt(240)).toEqual({ baseTop: 13, branchTop: 1, branchOpacity: 1 });
});
