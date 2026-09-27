import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The window chrome's tokens (ADR-105 to ADR-110), each ratio as tokens.css writes it beside
// the token: [foreground, background, ratio written, the floor it must clear].
type Pair = [string, string, number, number];

const CSS = readFileSync(new URL("tokens.css", import.meta.url), "utf8");

const BOTH: Pair[] = [
  ["--on-chrome", "--chrome", 8.98, 4.5],
  ["--on-chrome-soft", "--chrome", 5.56, 4.5],
  ["--chrome-hover", "--chrome", 1.25, 1.2],
  ["--on-chrome", "--chrome-hover", 7.21, 4.5],
  ["--chrome-pill", "--chrome", 8.98, 3],
  ["--on-chrome-pill", "--chrome-pill", 16.11, 4.5],
  ["--on-chrome-pill-soft", "--chrome-pill", 6.93, 4.5],
  ["--on-chrome-pill-soft", "--chrome-pill-hover", 5.89, 4.5],
  ["--on-chrome", "--chrome-painting", 6.96, 4.5],
  ["--on-chrome-painting-soft", "--chrome-painting", 5.44, 4.5],
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
  ["--trim", "--paper", 5.83, 3],
];
// The painting's brightest pixel, from paint-chrome.mjs, against the inks on it.
const PAINTING_LUMINANCE = 0.101;

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
function colour(name: string, theme: Map<string, string>[]): Rgb {
  let value: string | undefined;
  for (const each of theme) value = each.get(name) ?? value;
  if (value === undefined) throw new Error(`${name} is not declared`);
  return resolve(value, theme);
}

function resolve(value: string, theme: Map<string, string>[]): Rgb {
  if (value.startsWith("#")) return hex(value);
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  if (reference?.[1] !== undefined) return colour(reference[1], theme);
  const mix = /^color-mix\(in srgb, (.+) (\d+)%, (.+)\)$/.exec(value);
  if (mix?.[1] === undefined || mix[2] === undefined || mix[3] === undefined)
    throw new Error(`cannot resolve ${value}`);
  const [a, b] = [resolve(mix[1], theme), resolve(mix[3], theme)];
  const share = Number(mix[2]) / 100;
  const blend = (i: 0 | 1 | 2) => a[i] * share + b[i] * (1 - share);
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

// Each pair that misses its floor or no longer matches the ratio written beside the token.
function misses(pairs: Pair[], theme: Map<string, string>[]): string[] {
  return pairs.flatMap(([fg, bg, written, floor]) => {
    const ratio = contrast(luminance(colour(fg, theme)), luminance(colour(bg, theme)));
    const rounded = Math.round(ratio * 100) / 100;
    const off = ratio < floor || Math.abs(rounded - written) > 0.05;
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

  it("keep the painted bar's inks readable on its brightest pixel", () => {
    const ratios = ["--on-chrome", "--on-chrome-painting-soft"].map((ink) =>
      contrast(luminance(colour(ink, THEMES.light)), PAINTING_LUMINANCE),
    );
    expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
  });
});
