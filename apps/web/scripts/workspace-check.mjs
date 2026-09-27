#!/usr/bin/env node
// Measures the done predicate for the projects, sub-threads and carry work on the real app and
// the real Storybook. Every check runs on its own page, so one failure never hides another.
//
//   pnpm dev:web                                        # http://127.0.0.1:5173
//   .agents/skills/verify-storybook/scripts/control-storybook.sh launch   # http://127.0.0.1:6106
//   node apps/web/scripts/workspace-check.mjs [--base URL] [--storybook URL] [--only P1,P3] [--out dir]
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const playwright = await import(
  createRequire(path.join(ROOT, "apps/storybook/package.json")).resolve("playwright")
);
const { chromium } = playwright.default ?? playwright;

const argv = process.argv.slice(2);
const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const BASE = arg("--base", "http://127.0.0.1:5173");
const STORYBOOK = arg("--storybook", "http://127.0.0.1:6106");
const ONLY = arg("--only", "")
  .split(",")
  .filter((id) => id !== "");
const OUT = arg(
  "--out",
  path.join(
    ROOT,
    ".artifacts/workspace",
    new Date().toISOString().slice(0, 19).replaceAll(":", "-"),
  ),
);
mkdirSync(OUT, { recursive: true });

const LONG_TITLE = "Here's last week's profit by day, net of refunds";

// The darkest pixel and the mean in a box of the page, 0 (black) to 255 (white).
async function luminance(page, clip) {
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

async function openApp(browser, url = `${BASE}/`) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(url, { waitUntil: "load" });
  await page.locator(".thread-panel").first().waitFor({ timeout: 20_000 });
  return { page, errors };
}

const canvasOf = (page) => page.getByRole("region", { name: "Compose canvas" });
const mainPanel = (page) => page.locator(".thread-panel").first();

// Selects the first `length` characters of the main thread's first agent turn.
function selectReply(page, length) {
  return page.evaluate((count) => {
    const paragraph = document.querySelector(".turn-agent p");
    const text = paragraph.firstChild;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, count);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const box = range.getClientRects()[0];
    return { x: box.left + 12, y: box.top + box.height / 2, text: range.toString() };
  }, length);
}

// Carries whatever is under (x, y) to (toX, toY) with the mouse, sampling the page on the way.
async function carry(page, from, to, sample) {
  const samples = [];
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 8, { steps: 3 });
  for (const [i, point] of to.entries()) {
    await page.mouse.move(point.x, point.y, { steps: 8 });
    await page.waitForTimeout(120);
    if (sample) samples.push({ at: i, ...(await sample(point)) });
  }
  return samples;
}

// What the page shows under the pointer while something is carried.
function underPointer(page) {
  return (point) =>
    page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return {
        cursor: el ? getComputedStyle(el).cursor : "none",
        dragging: document.documentElement.dataset.dragging ?? "",
      };
    }, point);
}

// The canvas's own look, which a drop state has to change where the eye is: the whole pane, not
// the open space at the far end of the row.
function canvasLook(page) {
  return canvasOf(page).evaluate((el) => {
    const style = getComputedStyle(el);
    const veil = getComputedStyle(el, "::after");
    return [
      style.backgroundColor,
      style.backgroundImage,
      style.boxShadow,
      style.outlineStyle,
      veil.content === "none" ? "" : `${veil.opacity} ${veil.backgroundColor} ${veil.boxShadow}`,
    ].join(" | ");
  });
}

function laneCount(page) {
  return canvasOf(page).locator(":scope > article").count();
}

function laneTitles(page) {
  return canvasOf(page)
    .locator(":scope > article")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
}

// Drops `text` on the canvas the way another window's drag would arrive.
function dropText(page, text) {
  return canvasOf(page).evaluate((el, dropped) => {
    const data = new DataTransfer();
    data.setData("text/plain", dropped);
    for (const type of ["dragover", "drop"])
      el.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }),
      );
  }, text);
}

// A lane titled `title`: a blank thread renamed in place, or a dropped line of text where a
// blank thread has no title to click.
async function makeLane(page, title) {
  const before = await laneCount(page);
  await canvasOf(page).getByRole("button", { name: "Create blank thread" }).click();
  const lane = canvasOf(page).locator(":scope > article").nth(before);
  await lane.locator(".thread-panel").waitFor({ timeout: 10_000 });
  const named = await lane.locator(".thread-title").evaluate((el) => el.offsetWidth > 0);
  if (!named) {
    await canvasOf(page)
      .getByRole("button", { name: /^Close/ })
      .nth(before)
      .click();
    await dropText(page, title);
    await canvasOf(page).locator(":scope > article").nth(before).locator(".thread-panel").waitFor();
    return canvasOf(page).locator(":scope > article").nth(before);
  }
  await lane.locator(".thread-title").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(title);
  await page.keyboard.press("Enter");
  await page.mouse.move(5, 5);
  await page.waitForTimeout(250);
  return lane;
}

// Counts native drags, which hand the cursor to the browser.
async function countNativeDrags(page) {
  await page.evaluate(() => {
    window.nativeDragCount = 0;
    document.addEventListener("dragstart", () => (window.nativeDragCount += 1), true);
  });
  return () => page.evaluate(() => window.nativeDragCount);
}

const checks = {
  async P1(browser) {
    const { page } = await openApp(browser);
    const lane = await makeLane(page, LONG_TITLE);
    const header = lane.locator(".thread-header");
    const title = lane.locator(".thread-title");
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
    const rest = await title.evaluate((el) => {
      const bar = el.closest(".thread-header");
      const barBox = bar.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      const clip = el.closest("h2");
      const gripX = barBox.left + bar.clientLeft + bar.clientWidth / 2;
      return {
        whole: el.textContent,
        shown: clip.scrollWidth <= clip.clientWidth + 1,
        pastMiddle: box.right > gripX + 20,
        gripX,
        textY: box.top + box.height / 2,
      };
    });
    const beside = (dx) => ({ x: rest.gripX + dx, y: rest.textY - 6, width: 6, height: 12 });
    const ink = async () => {
      const [left, right] = [await luminance(page, beside(-15)), await luminance(page, beside(9))];
      return { min: Math.min(left.min, right.min) };
    };
    const restInk = await ink();
    const bar = await header.boundingBox();
    await page.mouse.move(bar.x + bar.width - 30, bar.y + bar.height / 2);
    await page.waitForTimeout(350);
    const hoverInk = await ink();
    const grip = await header.evaluate((el) => getComputedStyle(el, "::after").opacity);
    await header.screenshot({ path: path.join(OUT, "P1-bar-hover.png") });
    await title.hover({ position: { x: 8, y: 8 } });
    await page.waitForTimeout(350);
    const overTitle = await header.evaluate((el) => getComputedStyle(el, "::after").opacity);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(350);
    await header.screenshot({ path: path.join(OUT, "P1-bar-rest.png") });
    const ok =
      rest.whole === LONG_TITLE &&
      rest.shown &&
      rest.pastMiddle &&
      restInk.min < 140 &&
      hoverInk.min - restInk.min >= 60 &&
      grip === "1" &&
      overTitle === "0";
    return {
      ok,
      detail: `whole title shown ${rest.shown}, runs past the middle ${rest.pastMiddle}; ink beside the grip ${restInk.min} at rest, ${hoverInk.min} on hover; grip ${grip} on the bar, ${overTitle} over the title`,
    };
  },

  async P2(browser) {
    const { page } = await openApp(browser);
    const lane = await makeLane(page, LONG_TITLE);
    await lane.locator(".thread-title").click();
    const field = lane.locator(".thread-rename");
    await field.waitFor();
    const look = await field.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        rule: style.borderBottomWidth,
        decoration: style.textDecorationLine,
        focused: document.activeElement === el,
      };
    });
    await lane.locator(".thread-header").screenshot({ path: path.join(OUT, "P2-editing.png") });
    await page.keyboard.press("Escape");
    return {
      ok: look.rule === "0px" && look.decoration === "none" && look.focused,
      detail: `rule ${look.rule}, decoration ${look.decoration}, focused ${look.focused}`,
    };
  },

  async P3(browser) {
    const { page } = await openApp(browser);
    await makeLane(page, "First lane");
    await makeLane(page, "Second lane");
    await canvasOf(page).evaluate((el) => (el.scrollLeft = 0));
    const nativeDrags = await countNativeDrags(page);
    const rest = await canvasLook(page);
    const heading = mainPanel(page).locator(".card-heading").first();
    await heading.scrollIntoViewIfNeeded();
    const hb = await heading.boundingBox();
    const lanes = canvasOf(page).locator(":scope > article");
    const first = await lanes.nth(0).boundingBox();
    const gap = { x: first.x + first.width + 8, y: first.y + first.height / 2 };
    const overLane = { x: first.x + first.width / 2, y: first.y + first.height / 2 };
    const inThread = { x: hb.x + 80, y: hb.y + 140 };
    const samples = await carry(
      page,
      { x: hb.x + 30, y: hb.y + hb.height / 2 },
      [inThread, overLane, gap],
      async (point) => ({ ...(await underPointer(page)(point)), look: await canvasLook(page) }),
    );
    await page.screenshot({ path: path.join(OUT, "P3-carry-over-gap.png") });
    await page.mouse.up();
    await page.waitForTimeout(600);
    const titles = await laneTitles(page);
    const grabbing = samples.every((s) => s.cursor === "grabbing");
    const lit = samples.slice(1).every((s) => s.look !== rest);
    const landed = titles.length === 3 && titles[1] === "Last week's profit by day";
    const drags = await nativeDrags();

    const escapeFrom = await heading.boundingBox();
    await carry(page, { x: escapeFrom.x + 30, y: escapeFrom.y + escapeFrom.height / 2 }, [
      overLane,
    ]);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    const afterEscape = await canvasLook(page);
    await page.mouse.up();
    await page.waitForTimeout(400);
    const escaped = (await laneCount(page)) === 3 && afterEscape === rest;
    return {
      ok: drags === 0 && grabbing && lit && landed && escaped,
      detail: `native drags ${drags}; cursors ${samples.map((s) => s.cursor).join("/")}; canvas lit ${lit}; lanes ${titles.map((t) => t?.slice(0, 14)).join(" | ")}; Escape cancels ${escaped}`,
    };
  },

  async P3h(browser) {
    const { page } = await openApp(browser);
    const nativeDrags = await countNativeDrags(page);
    const picked = await selectReply(page, 33);
    const open = canvasOf(page).getByRole("button", { name: "Create blank thread" });
    const target = await open.boundingBox();
    const samples = await carry(
      page,
      picked,
      [{ x: target.x + target.width / 2, y: target.y - 60 }],
      underPointer(page),
    );
    await page.mouse.up();
    await page.waitForTimeout(800);
    const lane = canvasOf(page).locator(":scope > article").first();
    const draft = (await lane.count()) ? await lane.locator("textarea").inputValue() : "";
    const drags = await nativeDrags();
    return {
      ok:
        drags === 0 &&
        samples.every((s) => s.cursor === "grabbing") &&
        draft.startsWith(`> ${picked.text}`),
      detail: `native drags ${drags}; cursor ${samples.map((s) => s.cursor).join("/")}; draft ${JSON.stringify(draft.slice(0, 40))}`,
    };
  },

  async P8(browser) {
    const page = await browser.newPage({ viewport: { width: 800, height: 400 } });
    await page.goto(`${STORYBOOK}/iframe.html?id=foundations-disclosure--open&viewMode=story`);
    const header = page.locator(".disclosure-header");
    await header.waitFor({ timeout: 20_000 });
    const inset = await header.evaluate((el) => {
      const card = el.closest(".disclosure").parentElement.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return {
        left: Math.round(box.left - card.left - 1),
        right: Math.round(card.right - 1 - box.right),
      };
    });
    await header.hover();
    await page.waitForTimeout(200);
    await page
      .locator(".disclosure")
      .screenshot({ path: path.join(OUT, "P8-disclosure-hover.png") });
    return {
      ok: inset.left === 4 && inset.right === 4,
      detail: `hover fill inset ${inset.left}px left, ${inset.right}px right`,
    };
  },
};

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
