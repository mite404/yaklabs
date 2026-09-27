import { useCarryTarget, type Carried, type CarryPoint } from "@yaklabs/catalog/carry";
import { useState, type RefObject } from "react";
import { insertionIndex } from "../canvas";

/**
 * Where a carry over the canvas would land: the insertion index among the lanes, and the
 * marker's left edge in the row's own coordinates, or null at the end, where the open space
 * lights up instead.
 */
export type Landing = { at: number; marker: number | null };

// Half the gap between lanes, where the marker stands.
const HALF_GAP_PX = 8;

// Where a carry at `point` lands in `row`, measured from the lanes as they stand now.
function landingAt(row: HTMLElement, point: CarryPoint): Landing {
  const rowBox = row.getBoundingClientRect();
  const boxes = [...row.querySelectorAll(":scope > article")].map((lane) =>
    lane.getBoundingClientRect(),
  );
  const at = insertionIndex(
    boxes.map((box) => ({ left: box.left, width: box.width })),
    point.x,
  );
  const lane = boxes.at(at);
  const marker = lane === undefined ? null : lane.left - rowBox.left + row.scrollLeft - HALF_GAP_PX;
  return { at, marker };
}

// A landing as one comparable value, so a move to the same place sets no state.
function keyOf(landing: Landing | null): string {
  return landing === null ? "" : `${landing.at}:${String(landing.marker)}`;
}

/**
 * Makes the whole row a carry target (ADR-091): while a card or a highlight is over it, the
 * landing follows the pointer; a release hands `onCarry` what was carried and where it goes.
 * Escape, a cancel or leaving the row clears the landing, and so does the drop itself.
 */
export function useLanding(
  row: RefObject<HTMLElement | null>,
  onCarry: (carried: Carried, at: number) => void,
): Landing | null {
  const [landing, setLanding] = useState<Landing | null>(null);
  const follow = (next: Landing | null) => {
    setLanding((current) => (keyOf(current) === keyOf(next) ? current : next));
  };
  useCarryTarget(row, {
    over: (_carried, point) => {
      if (row.current !== null) follow(landingAt(row.current, point));
      return row.current !== null;
    },
    leave: () => {
      follow(null);
    },
    drop: (carried, point) => {
      follow(null);
      if (row.current !== null) onCarry(carried, landingAt(row.current, point).at);
    },
  });
  return landing;
}
