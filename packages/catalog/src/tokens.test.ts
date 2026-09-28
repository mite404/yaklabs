import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The window chrome's tokens (ADR-110 to ADR-115): [foreground, background, the ratio tokens.css
// writes beside them, the floor it must clear]. Each ratio is recomputed from the token values
// and must also appear, as written, in tokens.css, so a comment that drifts fails too.
type Pair = [string, string, number, number];
// A translucent fill as it lands on a ground: [fill, ground, ratio written, floor].
type Wash = [string, string, number, number];

const CSS = readFileSync(new URL("tokens.css", import.meta.url), "utf8");
// What paint-chrome.mjs measured on the painting it shipped, decoded from the file itself.
const PAINTING: unknown = JSON.parse(
  readFileSync(new URL("../../../apps/web/public/chrome/painting.json", import.meta.url), "utf8"),
);

const BOTH: Pair[] = [
  ["--on-chrome", "--chrome", 8.98, 4.5],
  ["--on-chrome-soft", "--chrome", 5.56, 4.5],
  ["--chrome-hover", "--chrome", 1.25, 1.2],
  ["--on-chrome", "--chrome-hover", 7.21, 4.5],
  ["--chrome-pill", "--chrome", 8.98, 3],
  ["--on-chrome-pill", "--chrome-pill", 16.11, 4.5],
  ["--on-chrome-pill-soft", "--chrome-pill", 6.93, 4.5],
  ["--on-chrome-pill-soft", "--chrome-pill-hover", 5.89, 4.5],
  ["--on-chrome", "--chrome-painting", 7.41, 4.5],
  ["--on-chrome-painting-soft", "--chrome-painting", 5.79, 4.5],
];
const LIGHT: Pair[] = [
  ["--desk", "--yak-paper-bright", 1.54, 1.3],
  ["--desk", "--paper", 1.43, 1.3],
  ["--desk", "--chrome", 6.3, 1.5],
  ["--trim", "--yak-paper-bright", 6.57, 3],
];
const DARK: Pair[] = [
  ["--desk", "--paper", 2.75, 1.3],
  ["--desk", "--chrome", 1.69, 1.5],
  ["--trim", "--paper", 5.79, 3],
];
const WASHES: Wash[] = [
  ["--chrome-line", "--chrome", 1.63, 1],
  ["--chrome-painting-hover", "--chrome-painting", 1.37, 1.2],
];
// The inks on the painted bar's hover fill, which only darkens the painting.
const ON_WASH: Pair[] = [
  ["--on-chrome", "--chrome-painting-hover", 10.12, 4.5],
  ["--on-chrome-painting-soft", "--chrome-painting-hover", 7.91, 4.5],
];
// The splash's line, the ink at a share over nothing, as it lands on the canvas field (--bg).
const SPLASH = { light: 1.26, dark: 1.36 };
// No pixel of the decoded painting may be brighter than this (paint-chrome.mjs).
const PAINTING_BOUND = 0.1;

type Rgb = [number, number, number];

// The declarations of one block: `:root {` or `:root[data-theme="dark"] {`.
function block(selector: string): Map<string, string> {
  const start = CSS.indexOf(`${selector} {`);
  const body = CSS.slice(start, CSS.indexOf("\n}", start));
  const declarations = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    const [name, value] = [match[1] ?? "", match[2] ?? ""];
    declarations.set(name, value.replaceAll(/\/\*.*?\*\//g, "").trim());
  }
  return declarations;
}

const hex = (value: string): Rgb => {
  const byte = (at: number) => parseInt(value.slice(1 + at, 3 + at), 16);
  return [byte(0), byte(2), byte(4)];
};

// A token's colour in a theme: a hex, a var() of another token, or a color-mix() in srgb of
// two of those; the dark block overrides the root one, as the cascade does.
function colour(name: string, theme: Map<string, string>[], ground?: Rgb): Rgb {
  let value: string | undefined;
  for (const each of theme) value = each.get(name) ?? value;
  if (value === undefined) throw new Error(`${name} is not declared`);
  return resolve(value, theme, ground);
}

// `transparent` is what the colour lands on, a `ground` a translucent token is given.
function resolve(value: string, theme: Map<string, string>[], ground?: Rgb): Rgb {
  if (value.startsWith("#")) return hex(value);
  if (value === "transparent" && ground !== undefined) return ground;
  const reference = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
  return reference === undefined ? mixOf(value, theme, ground) : colour(reference, theme, ground);
}

// `color-mix(in srgb, A n%, B)`: A at n% over B.
function mixOf(value: string, theme: Map<string, string>[], ground?: Rgb): Rgb {
  const [, first = "", share = "", second = ""] =
    /^color-mix\(in srgb, (.+) (\d+)%, (.+)\)$/.exec(value) ?? [];
  if (first === "") throw new Error(`cannot resolve ${value}`);
  const [a, b] = [resolve(first, theme, ground), resolve(second, theme, ground)];
  const k = Number(share) / 100;
  const blend = (i: 0 | 1 | 2) => a[i] * k + b[i] * (1 - k);
  return [blend(0), blend(1), blend(2)];
}

const linear = (channel: number): number => {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb): number =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const contrast = (a: number, b: number): number =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const ROOT = block(":root");
const THEMES = { light: [ROOT], dark: [ROOT, block(':root[data-theme="dark"]')] };

// A ratio as tokens.css writes it: "8.98:1", "16.1:1", "6.3:1".
const writtenInCss = (ratio: number): boolean =>
  [ratio.toFixed(2), ratio.toFixed(1), String(ratio)].some((text) => CSS.includes(`${text}:1`));

// Each pair that misses its floor, no longer matches its written ratio, or whose written ratio
// tokens.css no longer carries. A `ground` is where a translucent token lands.
function misses(pairs: Pair[], theme: Map<string, string>[], ground?: string): string[] {
  const under = ground === undefined ? undefined : colour(ground, theme);
  return pairs.flatMap(([fg, bg, written, floor]) => {
    const ratio = contrast(
      luminance(colour(fg, theme, under)),
      luminance(colour(bg, theme, under)),
    );
    const rounded = Math.round(ratio * 100) / 100;
    const off = ratio < floor || Math.abs(rounded - written) > 0.05 || !writtenInCss(written);
    return off ? [`${fg} on ${bg}: ${rounded}, written ${written}, floor ${floor}`] : [];
  });
}

describe("the window chrome's tokens", () => {
  it("clear their ratios in either theme, as tokens.css writes them", () => {
    expect([...misses(BOTH, THEMES.light), ...misses(BOTH, THEMES.dark)]).toEqual([]);
  });

  it("set the window apart from its desk, and the trim apart from the body", () => {
    expect([...misses(LIGHT, THEMES.light), ...misses(DARK, THEMES.dark)]).toEqual([]);
  });

  it("lay their translucent fills over the bar where they show, and the inks on them", () => {
    const washes = WASHES.flatMap(([fill, ground, written, floor]) =>
      misses([[fill, ground, written, floor]], THEMES.light, ground),
    );
    const inks = misses(ON_WASH, THEMES.light, "--chrome-painting");
    expect([...washes, ...inks]).toEqual([]);
  });

  it("keep the painted bar's inks readable on its brightest pixel, as the file holds it", () => {
    const facts =
      typeof PAINTING === "object" &&
      PAINTING !== null &&
      "mean" in PAINTING &&
      "brightest" in PAINTING
        ? { mean: String(PAINTING.mean), brightest: Number(PAINTING.brightest) }
        : { mean: "", brightest: Infinity };
    const ratios = ["--on-chrome", "--on-chrome-painting-soft"].map((ink) =>
      contrast(luminance(colour(ink, THEMES.light)), facts.brightest),
    );
    expect({
      mean: ROOT.get("--chrome-painting"),
      withinBound: facts.brightest <= PAINTING_BOUND,
      readable: Math.min(...ratios) >= 4.5,
    }).toEqual({ mean: facts.mean, withinBound: true, readable: true });
  });

  it("draw the splash's line faintly off the field in either theme", () => {
    const share = Number(/(\d+)%/.exec(ROOT.get("--splash-line") ?? "")?.[1]) / 100;
    const measured = Object.entries(THEMES).map(([name, theme]) => {
      const field = colour("--bg", theme);
      const ink = colour("--ink", theme);
      const over = (i: 0 | 1 | 2) => ink[i] * share + field[i] * (1 - share);
      const line: Rgb = [over(0), over(1), over(2)];
      return [name, Math.round(contrast(luminance(line), luminance(field)) * 100) / 100];
    });
    expect(Object.fromEntries(measured)).toEqual(SPLASH);
  });

  // The wash over the splash's painting is the paper at a share over nothing: enough that the
  // painting never carries text (at least 60%), never so much that it vanishes (at most 85%).
  it("wash the splash's painting towards the paper in either theme, never away", () => {
    for (const theme of Object.values(THEMES)) {
      let value: string | undefined;
      for (const each of theme) value = each.get("--splash-wash") ?? value;
      const share = /^color-mix\(in srgb, var\(--paper\) (\d+)%, transparent\)$/.exec(
        value ?? "",
      )?.[1];
      expect(Number(share)).toBeGreaterThanOrEqual(60);
      expect(Number(share)).toBeLessThanOrEqual(85);
    }
  });
});
