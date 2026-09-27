import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acceptCarry, armCarry, type Carried, type CarryTarget } from "./carry";

const carried: Carried = { kind: "text", text: "Saturday leads at every level" };

// A mouse event at a point, the way the browser would send it.
function pointer(type: string, x: number, y: number, buttons = 0): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  });
}

function middleOf(element: Element): { x: number; y: number } {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

// A fixed box on the page, so every point in these tests is known.
function place(name: string, left: number, top: number): HTMLElement {
  const element = document.createElement("div");
  element.dataset.name = name;
  element.textContent = name;
  Object.assign(element.style, {
    position: "fixed",
    left: `${left}px`,
    top: `${top}px`,
    width: "120px",
    height: "60px",
  });
  document.body.append(element);
  return element;
}

// A handle that lifts itself, as a card header lifts its card.
function handle(name: string, left: number, top: number): HTMLElement {
  const element = place(name, left, top);
  element.addEventListener("pointerdown", (event) => {
    armCarry(event, { carried, lift: element });
  });
  return element;
}

// Takes a carry from the middle of `from` to the middle of `to` and lets go there.
function carryTo(from: HTMLElement, to: HTMLElement): void {
  const start = middleOf(from);
  const end = middleOf(to);
  from.dispatchEvent(pointer("pointerdown", start.x, start.y, 1));
  to.dispatchEvent(pointer("pointermove", end.x, end.y, 1));
  to.dispatchEvent(pointer("pointerup", end.x, end.y));
}

function ghosts(): string[] {
  return [...document.querySelectorAll(".carry-ghost")].map((ghost) => ghost.textContent);
}

// Errors the page reports as uncaught. While a test listens for them, the runner logs them
// instead of failing the run.
let reported: unknown[] = [];
const report = (event: ErrorEvent) => {
  reported.push(event.error);
};

beforeEach(() => {
  reported = [];
  window.addEventListener("error", report);
});

afterEach(() => {
  window.removeEventListener("error", report);
  document.body.replaceChildren();
});

describe("a carry whose target throws", () => {
  it("still ends, and the next carry starts clean", () => {
    const first = handle("first", 20, 20);
    const second = handle("second", 20, 120);
    const spot = place("target", 300, 20);
    const failure = new Error("the target could not take it");
    const throwing: CarryTarget = {
      over: () => true,
      leave: () => {},
      drop: () => {
        throw failure;
      },
    };
    const stop = acceptCarry(spot, throwing);

    carryTo(first, spot);
    expect(reported).toEqual([failure]);
    expect(document.documentElement).not.toHaveAttribute("data-carrying");
    expect(first).not.toHaveAttribute("data-lifted");
    expect(ghosts()).toEqual([]);

    const start = middleOf(second);
    second.dispatchEvent(pointer("pointerdown", start.x, start.y, 1));
    second.dispatchEvent(pointer("pointermove", start.x + 20, start.y, 1));
    expect(ghosts()).toEqual(["second"]);
    expect(second).toHaveAttribute("data-lifted");
    second.dispatchEvent(pointer("pointerup", start.x + 20, start.y));
    expect(ghosts()).toEqual([]);
    stop();
  });
});
