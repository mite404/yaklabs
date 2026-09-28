#!/usr/bin/env node
// Draws the splash's Vitruvian sheet (apps/web/public/splash/vitruvian.svg): Leonardo's square
// with a circle inside it, and a protractor of ticks between the two, in black strokes on
// nothing, so the app can use it as a CSS mask filled with a token. Generated, so the geometry
// is a few numbers here rather than hand-placed coordinates, and identical on every run.
//
//   node apps/web/scripts/draw-vitruvian.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./harness.mjs";

const OUT = path.join(ROOT, "apps/web/public/splash/vitruvian.svg");
// The sheet is square; everything below is in these units and scales with the box it masks.
const SIDE = 1000;
const CENTRE = SIDE / 2;
// The ticks: one every 5 degrees, longer every 15, longest every 90, where it reaches the
// square. The circle's radius leaves exactly the longest tick between its rim and the square.
const TICK = { fine: 8, mid: 16, long: 30 };
const RADIUS = CENTRE - TICK.long;

const round = (n) => Math.round(n * 10) / 10;

// The tick at `degrees`, a segment from the rim outward: [x1, y1, x2, y2].
function tickAt(degrees) {
  const length = degrees % 90 === 0 ? TICK.long : degrees % 15 === 0 ? TICK.mid : TICK.fine;
  const angle = (degrees * Math.PI) / 180;
  const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
  return [RADIUS * dx, RADIUS * dy, (RADIUS + length) * dx, (RADIUS + length) * dy].map((n) =>
    round(CENTRE + n),
  );
}

const ticksOfWeight = (test) =>
  Array.from({ length: 360 / 5 }, (_, i) => i * 5)
    .filter(test)
    .map(tickAt)
    .map(([x1, y1, x2, y2]) => `M${x1} ${y1}L${x2} ${y2}`)
    .join(""); // → path data

// The strokes keep a screen pixel's width whatever the box's size (non-scaling-stroke), so the
// sheet is a hairline at a phone's width and at a desktop's alike. The mask is filled with one
// token, so the hierarchy is in the strokes' opacity: the square and the ticks at full, since
// they are the construction, the circle fainter, since the globe it rings draws that line.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIDE} ${SIDE}" fill="none" stroke="#000" stroke-width="1" vector-effect="non-scaling-stroke">
<rect x="1" y="1" width="${SIDE - 2}" height="${SIDE - 2}" vector-effect="non-scaling-stroke"/>
<circle cx="${CENTRE}" cy="${CENTRE}" r="${RADIUS}" stroke-opacity=".55" vector-effect="non-scaling-stroke"/>
<path vector-effect="non-scaling-stroke" stroke-width="1.5" d="${ticksOfWeight((d) => d % 90 === 0)}"/>
<path vector-effect="non-scaling-stroke" d="${ticksOfWeight((d) => d % 15 === 0 && d % 90 !== 0)}"/>
<path vector-effect="non-scaling-stroke" stroke-opacity=".7" d="${ticksOfWeight((d) => d % 15 !== 0)}"/>
</svg>
`;

writeFileSync(OUT, svg);
console.log(`wrote ${path.relative(ROOT, OUT)} (${svg.length} bytes)`);
