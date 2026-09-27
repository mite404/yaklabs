// The shell polish's scenarios (docs/reference/shell-polish/tasks.md, section 0.4), its
// measurements (0.5), and the baseline it compares against (0.6).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BASE, ROOT } from "./lever.mjs";

export const BASELINE = path.join(ROOT, ".artifacts/polish/baseline");
export const THEMES = ["light", "dark"];
export const WIDTHS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 767, height: 900 },
  { width: 390, height: 844 },
];

export const titleBar = (page) => page.locator('header[data-slot="title-bar"]');
export const sidebar = (page) => page.locator('[data-slot="sidebar"]');
export const shown = (page) => page.locator('[role="tabpanel"]:not([inert])');
export const canvasIn = (page) => shown(page).locator('[aria-label="Compose canvas"]');
export const tabs = (page) => page.getByRole("tablist", { name: "Open threads" }).getByRole("tab");
export const layoutButton = (page, name) =>
  page.getByRole("group", { name: "Layout" }).getByRole("button", { name, exact: true });

// "?scenario=demo" plus any extra query, such as "chrome=painting".
const addressOf = (scenario, query) =>
  `${BASE}/?scenario=${scenario}${query === undefined ? "" : `&${query}`}`;

/**
 * A fresh context on a scenario in a theme, ready once the data marker shows and the sidebar
 * has stopped loading (SC-bar). `motion` is "reduce" unless a predicate says otherwise.
 */
export async function openScenario(
  browser,
  {
    scenario = "demo",
    theme = "light",
    query,
    viewport = WIDTHS[0],
    motion = "reduce",
    ready = true,
  },
) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: motion,
    deviceScaleFactor: 1,
  });
  await context.addInitScript((chosen) => {
    localStorage.setItem("theme", chosen);
  }, theme);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(addressOf(scenario, query), { waitUntil: "load" });
  if (ready) {
    await page.locator('[data-slot="data-marker"]').waitFor({ timeout: 20_000 });
    await page
      .locator('[data-sidebar="menu-skeleton"]')
      .first()
      .waitFor({ state: "detached", timeout: 20_000 });
    await page.getByRole("tab", { selected: true }).waitFor({ timeout: 20_000 });
    await settle(page);
  }
  return { page, context, errors };
}

// Fonts loaded, every image decoded, two frames painted.
export async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

/** SC-empty: the Refund audit main, which has no lanes, on the canvas. */
export async function toEmpty(page) {
  const link = sidebar(page).getByRole("link", { name: "Refund audit" });
  // A narrow window keeps the sidebar in a sheet, so it goes by the thread's address instead.
  if (await link.isVisible()) await link.click();
  else await page.goto(`${BASE}/t/t-004${new URL(page.url()).search}`);
  await page.locator('[role="tabpanel"][aria-label="Refund audit"]:not([inert])').waitFor();
  await layoutButton(page, "Canvas").click();
  await canvasIn(page).waitFor();
  await page.mouse.move(0, 0);
  await settle(page);
}

/** SC-lanes: the Last week's sales tab, the profit main on its canvas with lanes. */
export async function toLanes(page) {
  await tabs(page).filter({ hasText: "Last week's sales" }).click();
  await page.locator(`[role="tabpanel"][aria-label="Last week's sales"]:not([inert])`).waitFor();
  await canvasIn(page).waitFor();
  await page.mouse.move(0, 0);
  await settle(page);
}

export const shot = (locator) => locator.screenshot({ animations: "disabled", caret: "hide" });

// WCAG 2.x relative luminance and contrast of two sRGB triples.
const linear = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export const luminanceOf = ([r, g, b]) =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
export function ratio(a, b) {
  const [hi, lo] = [luminanceOf(a), luminanceOf(b)].toSorted((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * worst(el, fg): the lowest contrast of `fg` against any pixel of `el`'s box with the
 * foreground hidden, so a painted ground is measured pixel by pixel. `hide` names the nodes to
 * hide, inside `el`; `grow` widens the box (a focus ring's reach).
 */
export async function worst(page, el, fg, { hide = ":scope *", grow = 0 } = {}) {
  const box = await el.boundingBox();
  const marked = await el.evaluate((node, selector) => {
    const targets = [...node.querySelectorAll(selector)];
    if (selector === ":scope") targets.push(node);
    for (const each of targets) each.dataset.polishHidden = "";
    return targets.length;
  }, hide);
  const style = await page.addStyleTag({
    content:
      "[data-polish-hidden]{visibility:hidden!important} [data-polish-hidden]::before,[data-polish-hidden]::after{visibility:hidden!important}",
  });
  const png = await page.screenshot({
    clip: {
      x: box.x - grow,
      y: box.y - grow,
      width: box.width + 2 * grow,
      height: box.height + 2 * grow,
    },
    animations: "disabled",
    caret: "hide",
  });
  await style.evaluate((node) => node.remove());
  await page.evaluate(() => {
    for (const node of document.querySelectorAll("[data-polish-hidden]"))
      delete node.dataset.polishHidden;
  });
  const { pixels } = await pixelsOf(page, png);
  let min = Infinity;
  for (const pixel of pixels) min = Math.min(min, ratio(fg, pixel));
  return { min: Math.round(min * 100) / 100, hidden: marked };
}

/** running(): document-timeline animations still playing (the scroll-driven tab fade excluded). */
export const running = (page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.timeline instanceof DocumentTimeline && a.playState === "running")
      .map((a) => a.animationName ?? a.constructor.name),
  );

/** A resolved custom property of the root, as the browser computes it into a colour. */
export const tokenColour = (page, name, within = "html") =>
  page.evaluate(
    ({ token, host }) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      document.querySelector(host).append(probe);
      const colour = getComputedStyle(probe).color;
      probe.remove();
      return colour;
    },
    { token: name, host: within },
  );

async function boxesOf(page) {
  return {
    tabpanel: await shown(page).boundingBox(),
    sidebar: await sidebar(page).boundingBox(),
    tabs: await tabs(page).evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    ),
  };
}

// What 0.6 records, per theme; the aria trees are theme-independent but cost nothing twice.
async function record(browser, theme) {
  const out = {};
  const files = {};
  const bar = await openScenario(browser, { theme });
  out.bar = {
    header: await titleBar(bar.page).ariaSnapshot(),
    sidebar: await sidebar(bar.page).ariaSnapshot(),
    boxes: await boxesOf(bar.page),
  };
  files[`bar-tabpanel-${theme}`] = await shot(shown(bar.page));
  files[`bar-header-${theme}`] = await shot(titleBar(bar.page));
  await toEmpty(bar.page);
  out.empty = {
    canvas: await canvasIn(bar.page).ariaSnapshot(),
    header: await titleBar(bar.page).ariaSnapshot(),
    sidebar: await sidebar(bar.page).ariaSnapshot(),
  };
  files[`empty-canvas-${theme}`] = await shot(canvasIn(bar.page));
  await toLanes(bar.page);
  out.lanes = {
    canvas: await canvasIn(bar.page).ariaSnapshot(),
    header: await titleBar(bar.page).ariaSnapshot(),
    sidebar: await sidebar(bar.page).ariaSnapshot(),
  };
  files[`lanes-canvas-${theme}`] = await shot(canvasIn(bar.page));
  await bar.context.close();
  for (const scenario of ["long", "loading"]) {
    const opened = await openScenario(browser, { scenario, theme, ready: false });
    await opened.page.locator('[data-slot="data-marker"]').waitFor({ timeout: 20_000 });
    await opened.page.waitForTimeout(1500);
    out[scenario] = { header: await titleBar(opened.page).ariaSnapshot() };
    await opened.context.close();
  }
  return { out, files };
}

/** Writes the 0.6 baseline to `dir`: aria trees, boxes, and the region shots, light and dark. */
export async function capture(browser, dir = BASELINE) {
  mkdirSync(dir, { recursive: true });
  const all = {};
  for (const theme of THEMES) {
    const { out, files } = await record(browser, theme);
    all[theme] = out;
    for (const [name, png] of Object.entries(files))
      writeFileSync(path.join(dir, `${name}.png`), png);
  }
  writeFileSync(path.join(dir, "baseline.json"), JSON.stringify(all, null, 2));
  return all;
}

export const readBaseline = (dir = BASELINE) => ({
  json: JSON.parse(readFileSync(path.join(dir, "baseline.json"), "utf8")),
  png: (name) => readFileSync(path.join(dir, `${name}.png`)),
});

export { record };
