import type { ReactElement } from "react";

// The darker band at each bar's base is a fixed height, not a share of the bar,
// so tall and short bars are grounded identically.
const BASE_BAND_PX = 20;
const CORNER_RADIUS = 4;
// Enough stops for SVG's straight-line interpolation to trace the ease curve smoothly.
const FEATHER_STOPS = 9;

type BarGeometry = { x: number; y: number; width: number; height: number; index: number };

// A rectangle with only its top corners rounded, as SVG path data.
function topRoundedRect({ x, y, width, height }: BarGeometry): string {
  const r = Math.min(CORNER_RADIUS, width / 2, height);
  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    `H${x + width - r}`,
    `A${r},${r} 0 0 1 ${x + width},${y + r}`,
    `V${y + height}`,
    "Z",
  ].join(" ");
}

// Smoothstep (ease-in-out): zero slope at both ends of the band, so there is no kink
// where the band begins. A linear ramp ends abruptly and the eye reads that change in
// rate as a faint line (Mach banding).
function feather(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * A Recharts `shape` for bars that stay the data colour for most of their height and
 * deepen over the bottom 20px toward `--data-deep` along an ease-in-out curve, a grounded
 * base like a soft shadow.
 * Each bar gets its own gradient so the band is 20px on every bar; bars shorter than
 * the band fade over their full height.
 * @param idPrefix Unique per chart (e.g. from `useId`), so gradient ids never collide.
 */
export function gradientBar(idPrefix: string) {
  // React ids contain characters like "«»" or ":" that break url(#...) references.
  const safePrefix = idPrefix.replace(/[^\w-]/g, "");
  return function GradientBarShape(props: unknown): ReactElement {
    const bar = props as BarGeometry;
    if (!(bar.height > 0) || !(bar.width > 0)) return <g />;
    const id = `${safePrefix}-bar-${bar.index}`;
    const bandStart = Math.max(0, 1 - BASE_BAND_PX / bar.height);
    const path = topRoundedRect(bar);
    // The base shade is layered over the solid bar with eased opacity stops.
    const stops = Array.from({ length: FEATHER_STOPS }, (_, i) => {
      const t = i / (FEATHER_STOPS - 1);
      return { offset: bandStart + t * (1 - bandStart), opacity: feather(t) };
    });
    return (
      <g>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {stops.map((stop) => (
              <stop
                key={stop.offset}
                offset={stop.offset}
                stopColor="var(--data-deep)"
                stopOpacity={stop.opacity}
              />
            ))}
          </linearGradient>
        </defs>
        <path d={path} fill="var(--data)" />
        <path d={path} fill={`url(#${id})`} />
      </g>
    );
  };
}
