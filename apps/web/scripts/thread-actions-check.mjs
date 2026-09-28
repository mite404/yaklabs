#!/usr/bin/env node
// oxlint-disable no-await-in-loop, no-console -- a lever drives one step at a time and reports on stdout
// The thread actions menu, on the real app (ADR-124 to ADR-129): the checks A1 to A8 and S1
// to S2, or with --shots its pictures, light and dark, a desktop and a 390px phone. It waits on
// the tree and the tabs, never on the data marker, which main has since removed (ADR-123).
//
//   pnpm dev:web                                          # http://127.0.0.1:5173
//   node apps/web/scripts/thread-actions-check.mjs [--only A1,A2] [--out dir]
//   node apps/web/scripts/thread-actions-check.mjs --shots docs/trail/evidence/thread-actions/after
import { mkdirSync } from "node:fs";
import path from "node:path";
import { arg, chromium, ROOT } from "./harness.mjs";
import { run } from "./lever.mjs";
import { shareChecks } from "./share-checks.mjs";
import { threadActionChecks } from "./thread-actions-checks.mjs";

const BASE = arg("--base", "http://127.0.0.1:5173");
const SHOTS = arg("--shots");

const THEMES = ["light", "dark"];
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

// A fresh context on the demo scenario in a theme, ready once the tree has its rows and a tab
// is selected (a phone hides the tabs behind its views, so the tab only needs to be attached).
async function openDemo(browser, { theme, viewport, thread = "" }) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await context.addInitScript((chosen) => {
    localStorage.setItem("theme", chosen);
  }, theme);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`${BASE}/${thread === "" ? "" : `t/${thread}`}?scenario=demo`);
  await page
    .locator('[data-sidebar="menu-skeleton"]')
    .first()
    .waitFor({ state: "detached", timeout: 20_000 });
  await page
    .getByRole("tab", { selected: true, includeHidden: true })
    .waitFor({ state: "attached", timeout: 20_000 });
  await page.locator(".thread-panel").first().waitFor({ state: "attached", timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  return { page, context, errors };
}

// The pictures: the desktop window, its thread header, and its menu open; the phone's bar, its
// "⋯" open, and its sidebar.
async function shots(browser, dir) {
  mkdirSync(dir, { recursive: true });
  const file = (name) => path.join(dir, `${name}.png`);
  for (const theme of THEMES) {
    const desk = await openDemo(browser, { theme, viewport: DESKTOP });
    await desk.page.screenshot({ path: file(`desktop-${theme}`) });
    const header = desk.page.locator('[role="tabpanel"]:not([inert]) .thread-header').first();
    await header.screenshot({ path: file(`desktop-header-${theme}`) });
    const more = header.getByRole("button", { name: "Thread actions" });
    if ((await more.count()) > 0) {
      await more.click();
      await desk.page.getByRole("menu").waitFor();
      await desk.page.screenshot({ path: file(`desktop-menu-${theme}`) });
    }
    await desk.context.close();

    const phone = await openDemo(browser, { theme, viewport: PHONE });
    await phone.page.screenshot({ path: file(`phone-${theme}`) });
    const phoneMore = phone.page.getByRole("button", { name: /^Thread (and project )?actions$/ });
    await phoneMore.first().click();
    await phone.page.getByRole("menu").waitFor();
    await phone.page.screenshot({ path: file(`phone-menu-${theme}`) });
    await phone.page.keyboard.press("Escape");
    await phone.page.getByRole("button", { name: "Toggle sidebar" }).click();
    await phone.page.waitForTimeout(400);
    await phone.page.screenshot({ path: file(`phone-sidebar-${theme}`) });
    await phone.context.close();
  }
  console.log(`shots: ${dir}`);
}

if (SHOTS === undefined) {
  await run({ ...threadActionChecks, ...shareChecks });
} else {
  const browser = await chromium.launch({ args: ["--disable-partial-raster"] }); // ADR-107
  try {
    await shots(browser, path.resolve(ROOT, SHOTS));
  } finally {
    await browser.close();
  }
}
