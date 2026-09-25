import type { ReactElement } from "react";

// The darker band at each bar's base is a fixed height, not a share of the bar,
// so tall and short bars are grounded identically.
const BASE_BAND_PX = 20;
const CORNER_RADIUS = 4;

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

/**
 * A Recharts `shape` for bars that stay the data colour for most of their height and
 * deepen over the bottom 20px toward `--data-deep`, a grounded base like a soft shadow.
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
    return (
      <g>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--data)" />
            <stop offset={bandStart} stopColor="var(--data)" />
            <stop offset="1" stopColor="var(--data-deep)" />
          </linearGradient>
        </defs>
        <path d={topRoundedRect(bar)} fill={`url(#${id})`} />
      </g>
    );
  };
}
