// The harness the workspace lever runs on: a browser, the addresses, the output folder, and a
// runner that gives every check its own page so one failure never hides another.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "../../..");
const playwright = await import(
  createRequire(path.join(ROOT, "apps/storybook/package.json")).resolve("playwright")
);
const { chromium } = playwright.default ?? playwright;

const argv = process.argv.slice(2);
const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);

export const BASE = arg("--base", "http://127.0.0.1:5173");
export const STORYBOOK = arg("--storybook", "http://127.0.0.1:6106");
export const OUT = arg(
  "--out",
  path.join(
    ROOT,
    ".artifacts/workspace",
    new Date().toISOString().slice(0, 19).replaceAll(":", "-"),
  ),
);
const ONLY = arg("--only", "")
  .split(",")
  .filter((id) => id !== "");
mkdirSync(OUT, { recursive: true });

/** Where a check saves a picture of what it measured. */
export const shotPath = (name) => path.join(OUT, `${name}.png`);

/**
 * A fresh browser context on `url` (its own OPFS, so no check sees another's data), ready once
 * a thread panel, or `ready` when given, is on screen.
 */
export async function openApp(browser, url = `${BASE}/`, { ready = ".thread-panel" } = {}) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(url, { waitUntil: "load" });
  if (ready) await page.locator(ready).first().waitFor({ timeout: 20_000 });
  return { page, errors };
}

/** The darkest pixel and the mean in a box of the page, 0 (black) to 255 (white). */
export async function luminance(page, clip) {
  const png = await page.screenshot({ clip });
  return page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let min = 255;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += l;
      min = Math.min(min, l);
    }
    return { min: Math.round(min), mean: Math.round(sum / (data.length / 4)) };
  }, png.toString("base64"));
}

/** Runs each check (or those named by --only), prints PASS or FAIL, writes results.json. */
export async function run(checks) {
  const browser = await chromium.launch();
  const results = [];
  for (const [id, check] of Object.entries(checks)) {
    if (ONLY.length > 0 && !ONLY.includes(id)) continue;
    try {
      const { ok, detail } = await check(browser);
      results.push({ id, ok, detail });
    } catch (error) {
      results.push({ id, ok: false, detail: String(error).split("\n")[0] });
    }
    const last = results.at(-1);
    console.log(`${last.ok ? "PASS" : "FAIL"} ${last.id} · ${last.detail}`);
  }
  await browser.close();
  writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  console.log(`artifacts: ${OUT}`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
