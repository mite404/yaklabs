import { useId } from "react";
import { Link } from "react-router";

// The page about the verify-ui-drift tooling (ADR-160), which the seal leads to.
const TOOLING_PATH = "/verify-ui-tooling";

// The seal's drawing, in a 120-unit box about its centre: the serrated edge, the face, the
// ring the words sit in, and the two arcs the words follow.
const CENTRE = 60;
const TEETH = 36;
const EDGE_OUTER = 58;
const EDGE_INNER = 53;
const FACE = 47;
const RING = 44;
const TOP_ARC = { radius: 35, from: -140, to: -40 };
const BOTTOM_ARC = { radius: 42, from: 150, to: 30 };
const TOP_WORDS = "YAKLABS";
const BOTTOM_WORDS = "SEAL OF EVIDENCE";

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

// A point `radius` out from the centre at `degrees`, clockwise from three o'clock, as SVG turns.
const pointAt = (radius: number, degrees: number): string =>
  `${(CENTRE + radius * Math.cos(radians(degrees))).toFixed(2)} ${(CENTRE + radius * Math.sin(radians(degrees))).toFixed(2)}`;

// The serrated edge as one closed path: `teeth` points out at `outer`, each followed by one in
// at `inner`, starting at twelve o'clock.
function starburst(teeth: number, outer: number, inner: number): string {
  const step = 180 / teeth; // → degrees between a point and the notch after it
  const points = Array.from({ length: teeth * 2 }, (_, i) =>
    pointAt(i % 2 === 0 ? outer : inner, i * step - 90),
  ); // → "x y"[]
  return `M${points.join("L")}Z`;
}

// An arc from `from` to `to` degrees, the short way round: clockwise where `to` is the greater
// angle, so the words along it read left to right over the top and under the bottom alike.
function arc({ radius, from, to }: { radius: number; from: number; to: number }): string {
  const sweep = to > from ? 1 : 0;
  return `M${pointAt(radius, from)}A${radius} ${radius} 0 0 ${sweep} ${pointAt(radius, to)}`;
}

// The face's ring and the words along it: a hairline of the deep gold at the face's edge, a
// glint inside it, "Yaklabs" over the top and "Seal of evidence" under the bottom.
function Ring({ top, bottom }: { top: string; bottom: string }) {
  return (
    <>
      <circle cx={CENTRE} cy={CENTRE} r={FACE} fill="var(--seal-gold)" />
      <circle
        cx={CENTRE}
        cy={CENTRE}
        r={FACE}
        fill="none"
        stroke="var(--seal-gold-deep)"
        strokeWidth="1"
      />
      <circle
        cx={CENTRE}
        cy={CENTRE}
        r={RING}
        fill="none"
        stroke="var(--seal-gold-glint)"
        strokeWidth="0.75"
      />
      <text className="seal-words" fontSize="8.5">
        <textPath href={`#${top}`} startOffset="50%" textAnchor="middle">
          {TOP_WORDS}
        </textPath>
      </text>
      <text className="seal-words" fontSize="7">
        <textPath href={`#${bottom}`} startOffset="50%" textAnchor="middle">
          {BOTTOM_WORDS}
        </textPath>
      </text>
    </>
  );
}

/**
 * The design tooling seal: a gold medal with a serrated edge, "Yaklabs" over the top of its
 * ring and "Seal of evidence" under the bottom, drawn in the seal's own tokens so it keeps one
 * colour in either theme. A picture only, with no name of its own: the link or the heading
 * beside it says what it is.
 * @param size The seal's width and height in CSS pixels.
 */
export function Seal({ size = 112, className }: { size?: number; className?: string }) {
  const id = useId(); // → unique per instance, so two seals on a page never share a gradient
  const face = `${id}-face`;
  const top = `${id}-top`;
  const bottom = `${id}-bottom`;
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <radialGradient id={face} cx="32%" cy="28%" r="78%">
          <stop offset="0" stopColor="var(--seal-gold-glint)" />
          <stop offset="0.45" stopColor="var(--seal-gold)" />
          <stop offset="1" stopColor="var(--seal-gold-deep)" />
        </radialGradient>
        <path id={top} d={arc(TOP_ARC)} />
        <path id={bottom} d={arc(BOTTOM_ARC)} />
      </defs>
      <path
        d={starburst(TEETH, EDGE_OUTER, EDGE_INNER)}
        fill={`url(#${face})`}
        stroke="var(--seal-gold-deep)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <Ring top={top} bottom={bottom} />
    </svg>
  );
}

/**
 * The welcome's link to the tooling page (ADR-160): the seal with an ink ribbon across its
 * middle saying "Includes design tooling", which runs past the seal on either side. The ribbon
 * is the link's name and its only words, so a screen reader hears what a sighted visitor reads.
 * It fills with moss on hover, as the site's button does.
 */
export function DesignToolingSeal({ className }: { className?: string }) {
  return (
    <Link
      to={TOOLING_PATH}
      data-slot="design-tooling-seal"
      className={`seal-link ${className ?? ""}`}
    >
      <Seal />
      <span className="seal-ribbon">Includes design tooling</span>
    </Link>
  );
}
