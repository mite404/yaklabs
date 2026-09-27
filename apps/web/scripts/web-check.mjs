#!/usr/bin/env node
// Drive the web app the way a person would and keep the proof: screenshots, the agent's reply
// text, and every console error. Exits 1 on any failed step.
//
//   pnpm dev:web                                   # in one terminal
//   node apps/web/scripts/web-check.mjs [--base http://127.0.0.1:5173] [--out dir]
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
const OUT = arg(
  "--out",
  path.join(ROOT, ".artifacts/web", new Date().toISOString().slice(0, 19).replaceAll(":", "-")),
);
mkdirSync(OUT, { recursive: true });

const results = [];
const errors = [];
function record(step, ok, detail = "") {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${step}${detail ? ` · ${detail}` : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(String(error)));
// A dev server never answers 5xx on purpose; Vite's 504 "Outdated Optimize Dep" is the blank
// first page after a fresh install, so the first load has to be clean, not the second.
page.on("response", (response) => {
  if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
});
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });

// Selects the first `count` characters of the main thread's first agent turn, scrolled into
// view as a person would: a highlight a press can then carry. Returns where to press and what
// was selected.
function highlight(count) {
  return page.evaluate((length) => {
    const paragraph = document.querySelector('[role="tabpanel"]:not([inert]) .turn-agent p');
    paragraph.scrollIntoView({ block: "center" });
    const range = document.createRange();
    range.setStart(paragraph.firstChild, 0);
    range.setEnd(paragraph.firstChild, length);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    const box = range.getClientRects()[0];
    return { x: box.left + 12, y: box.top + box.height / 2, text: range.toString() };
  }, count);
}

// Presses at `from`, lifts past the carry's dead zone and lets go at `to` (ADR-091).
async function carryTo(from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 8, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

// The theme lives in the account menu, in the title bar's corner.
async function chooseTheme(name) {
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitemradio", { name }).click();
  await page.keyboard.press("Escape");
}

try {
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  const title = page.getByRole("heading", { name: "Last week's profit by day" });
  await title.waitFor({ timeout: 15_000 });
  await shot("thread");
  record("thread renders the profit card", true);

  const slider = page.getByRole("slider", { name: "Profit measure" });
  await slider.focus();
  await page.keyboard.press("End");
  const sentence = page.locator(".live-sentence");
  await page.waitForFunction(() =>
    document.querySelector(".live-sentence")?.textContent?.includes("Net profit"),
  );
  await shot("thread-net-profit");
  record("slider moves to Net profit", true, (await sentence.textContent()).trim());

  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("Why is Saturday so high?");
  await page.keyboard.press("Enter");
  const reply = page.locator(".turn-agent").last();
  await page.waitForFunction(
    () => {
      const turns = [...document.querySelectorAll(".turn-agent")];
      const last = turns.at(-1);
      return (
        turns.length >= 2 &&
        last?.textContent?.includes("Net profit") &&
        !last.querySelector("[data-streaming]")
      );
    },
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(1500);
  await shot("thread-reply");
  const replyText = (await reply.textContent()).trim();
  record(
    "agent reply speaks to the chosen view",
    replyText.includes("Net profit"),
    replyText.slice(0, 120),
  );
  const chip = page.locator(".turn-user").last();
  record(
    "the sent message carries the card choice as a chip",
    (await chip.textContent()).includes("Net profit"),
  );

  // The worker keeps the conversation in the browser's private file system (ADR-081): a fresh
  // load must show the sent message, its chip and the reply again.
  await page.reload({ waitUntil: "load" });
  await title.waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
  await shot("thread-after-reload");
  const turns = await page.locator(".turn-user, .turn-agent").allTextContents();
  record(
    "the conversation survives a reload",
    turns.some((t) => t.includes("Why is Saturday so high?")) &&
      turns.some((t) => t.includes("Answering about Net profit")),
    `${turns.length} turns after reload`,
  );
  const marker = (await page.locator('[data-slot="data-marker"]').innerText()).trim();
  record(
    "the marker says the threads are kept on this device, not in memory",
    marker === "On this device",
    marker,
  );

  // The look is measured, not the attribute: the page, the paper and the ink must all move.
  const surface = () =>
    page.evaluate(() => {
      const panel = document.querySelector(".thread-panel");
      return {
        page: getComputedStyle(document.documentElement).backgroundColor,
        paper: getComputedStyle(panel).backgroundColor,
        ink: getComputedStyle(panel).color,
      };
    });
  const light = await surface();
  await chooseTheme("Dark");
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await page.waitForTimeout(300);
  await shot("thread-dark");
  const dark = await surface();
  record(
    "dark mode changes the page, the paper and the ink",
    light.page !== dark.page && light.paper !== dark.paper && light.ink !== dark.ink,
    `paper ${light.paper} → ${dark.paper}`,
  );
  await chooseTheme("Light");
  await page.waitForFunction(() => document.documentElement.dataset.theme === "light");

  const rail = page.locator('[data-slot="sidebar"]');
  record(
    "the sidebar shows Kay, Documentation and Lab",
    (await rail.getByRole("link", { name: "Kay", exact: true }).isVisible()) &&
      (await rail.getByRole("link", { name: "Documentation" }).isVisible()) &&
      (await rail.getByRole("link", { name: "Lab" }).isVisible()),
  );

  const canvas = page
    .locator('[role="tabpanel"]:not([inert])')
    .getByRole("region", { name: "Compose canvas" });
  record(
    "the canvas opens empty and invites a drop",
    await canvas.getByText("Drag a text selection or card").isVisible(),
  );

  // A highlight carried out of the thread starts a thread where it lands.
  const picked = await highlight(18);
  const empty = await canvas.getByText("Drag a text selection or card").boundingBox();
  await carryTo(picked, { x: empty.x + empty.width / 2, y: empty.y - 40 });
  const lane = canvas.locator("article").first();
  await lane.locator(".thread-panel").waitFor({ timeout: 10_000 });
  const laneDraft = await lane.locator("textarea").inputValue();
  record(
    "a dropped highlight starts a thread lane with the quote as its draft",
    laneDraft.startsWith(`> ${picked.text}`),
    laneDraft.split("\n")[0],
  );

  // The profit card sits at the top of a thread that has scrolled to its end.
  const heading = page
    .locator('[data-slot="resizable-panel"]')
    .first()
    .locator(".card-heading")
    .first();
  await heading.scrollIntoViewIfNeeded();
  await canvas.getByText("Drag a text selection or card").scrollIntoViewIfNeeded();
  const openSpaceBox = await canvas.getByText("Drag a text selection or card").boundingBox();
  const headingBox = await heading.boundingBox();
  await page.mouse.move(headingBox.x + 30, headingBox.y + headingBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(headingBox.x + 60, headingBox.y + 20, { steps: 4 });
  await page.mouse.move(openSpaceBox.x + 20, openSpaceBox.y + 20, { steps: 8 });
  const liftedCards = await page.locator(".card[data-lifted]").count();
  await page.mouse.up();
  await canvas.locator("article").nth(1).locator(".card").waitFor({ timeout: 10_000 });
  await shot("canvas-lanes");
  record(
    "a card dragged by its header opens large in its own lane",
    await canvas.locator("article").nth(1).getByRole("slider").isVisible(),
  );
  record(
    "while a card is dragged out of the thread, the card left behind dims, and comes back after",
    liftedCards === 1 && (await page.locator(".card[data-lifted]").count()) === 0,
    `${liftedCards} dimmed during, ${await page.locator(".card[data-lifted]").count()} after`,
  );

  // With a lane on it the canvas has no right edge: the ground runs a pane past the open space,
  // the scrollbar says so, and the ground itself drags to pan.
  // Headless Chromium hides scrollbars, so the bar itself is not measured here; the overflow
  // it would report is.
  const overflow = await canvas.evaluate((el) => el.scrollWidth - el.clientWidth);
  record(
    "the ground runs a pane past the last lane",
    overflow >= 500,
    `${overflow}px past the pane`,
  );
  const canvasBox = await canvas.boundingBox();
  await page.mouse.move(canvasBox.x + 8, canvasBox.y + 8);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 8 - 200, canvasBox.y + 8, { steps: 6 });
  const dragged = await canvas.evaluate((el) => el.scrollLeft);
  await page.mouse.up();
  record("the ground drags to pan the row", dragged > 150, `scrolled ${Math.round(dragged)}px`);
  await canvas.evaluate((el) => {
    el.scrollLeft = 0;
  });

  // The grip fades up in the middle of a lane's title bar, and stays away over the title.
  const firstHeader = canvas.locator("article").first().locator(".thread-header");
  const firstHeaderBox = await firstHeader.boundingBox();
  await page.mouse.move(
    firstHeaderBox.x + firstHeaderBox.width * 0.6,
    firstHeaderBox.y + firstHeaderBox.height / 2,
  );
  await page.waitForTimeout(250);
  const gripShown = await firstHeader.evaluate((el) => getComputedStyle(el, "::after").opacity);
  const titleButton = canvas.locator("article").first().locator(".thread-title");
  await titleButton.hover();
  await page.waitForTimeout(250);
  const gripHidden = await firstHeader.evaluate((el) => getComputedStyle(el, "::after").opacity);
  const titleCursor = await titleButton.evaluate((el) => getComputedStyle(el).cursor);
  record(
    "the grip fades up in the middle of the title bar, and not over the title, which is for renaming",
    gripShown === "1" && gripHidden === "0" && titleCursor === "text",
    `grip ${gripShown} in the middle, ${gripHidden} over the title; title cursor ${titleCursor}`,
  );
  await page.mouse.move(10, 10);

  // The gap after a lane drags its width; the hint line lights where the pointer is.
  const separator = canvas.getByRole("separator", { name: /^Resize / }).first();
  const separatorBox = await separator.boundingBox();
  const laneWidthBefore = (await lane.boundingBox()).width;
  const hoverY = separatorBox.y + separatorBox.height * 0.3;
  await page.mouse.move(separatorBox.x + separatorBox.width / 2, hoverY);
  // The line fades in over 120ms; read it once it has arrived.
  for (let i = 0; i < 5; i++) {
    const shown = await separator.evaluate(
      (el) => getComputedStyle(el, "::before").opacity === "1",
    );
    if (shown) break;
    await page.waitForTimeout(100);
  }
  const hint = await separator.evaluate((el, y) => {
    const style = getComputedStyle(el, "::before");
    return {
      opacity: style.opacity,
      centre: parseFloat(el.style.getPropertyValue("--hint-y")),
      y,
      image: style.backgroundImage,
    };
  }, hoverY - separatorBox.y);
  // Full ink for 20px either side of the pointer, gone by 50px: the stops appear either as
  // calc() offsets or, once resolved, as px positions around the centre.
  const stops = [...hint.image.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  const stopAt = (n) => stops.some((v) => Math.abs(v - n) < 1);
  const profile =
    (stopAt(20) && stopAt(50)) ||
    [-50, -20, 20, 50].every((offset) => stopAt(hint.centre + offset));
  record(
    "the hint line shows on hover, centred on the pointer, holding 20px and gone by 50px",
    hint.opacity === "1" && Math.abs(hint.centre - hint.y) < 2 && profile,
    `opacity ${hint.opacity}, centre ${Math.round(hint.centre)} for pointer at ${Math.round(hint.y)}; stops ${stops.join(" ")}`,
  );
  await page.mouse.down();
  await page.mouse.move(separatorBox.x + 140, hoverY, { steps: 6 });
  await page.mouse.up();
  const laneWidthAfter = (await lane.boundingBox()).width;
  record(
    "a lane's width drags by the gap after it",
    laneWidthAfter > laneWidthBefore + 100,
    `${Math.round(laneWidthBefore)} → ${Math.round(laneWidthAfter)}px`,
  );
  await page.mouse.move(10, 10);

  // Two lanes outgrow the pane; the row pans by a sideways wheel, and by a vertical one over
  // the ground between and after the lanes.
  const openSpace = canvas.getByText("Drag a text selection or card");
  await openSpace.scrollIntoViewIfNeeded();
  const openBox = await openSpace.boundingBox();
  const leftBefore = await canvas.evaluate((el) => el.scrollLeft);
  await page.mouse.move(openBox.x + openBox.width / 2, openBox.y - 40);
  await page.mouse.wheel(0, 160);
  await page.waitForTimeout(100);
  const panned = await canvas.evaluate((el) => el.scrollLeft);
  record(
    "a vertical wheel over the ground pans the row sideways",
    panned - leftBefore >= 100,
    `scrolled ${Math.round(panned - leftBefore)}px`,
  );
  await canvas.evaluate((el) => {
    el.scrollLeft = 0;
  });

  // A third lane, then the first one taken by its title bar and carried to the end of the
  // row: a copy of it floats under the pointer, the lane itself waits dimmed and slides to the
  // slot it would take, and the drop lands it there.
  await openSpace.scrollIntoViewIfNeeded();
  const third = await highlight(20);
  const end = await openSpace.boundingBox();
  await carryTo(third, { x: end.x + end.width / 2, y: end.y - 40 });
  await canvas.locator("article").nth(2).locator(".thread-panel").waitFor({ timeout: 10_000 });
  const labelsBefore = await canvas
    .locator("article")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  const laneWidths = await canvas
    .locator("article")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  await canvas.evaluate((el) => {
    el.scrollLeft = 0;
  });
  const titleBar = canvas.locator("article").first().locator(".thread-header");
  const titleBox = await titleBar.boundingBox();
  const grabHand = await titleBar.evaluate((el) => getComputedStyle(el).cursor);
  const laneBox = await canvas.locator("article").first().boundingBox();
  const grip = titleBox.x + titleBox.width * 0.6;
  await page.mouse.move(grip, titleBox.y + titleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip + 300, titleBox.y + 30, { steps: 6 });
  await page.waitForTimeout(250);
  const lift = await page.evaluate(
    ([expectedLeft, laneWidth]) => {
      const ghost = document.querySelector("[data-ghost]");
      const lifted = document.querySelector("[data-lifted]");
      if (!ghost || !lifted) return { ghost: Boolean(ghost), lifted: Boolean(lifted) };
      const ghostBox = ghost.getBoundingClientRect();
      return {
        ghost: true,
        lifted: true,
        ghostOpacity: getComputedStyle(ghost).opacity,
        liftedOpacity: getComputedStyle(lifted).opacity,
        ghostFollows: Math.abs(ghostBox.left - expectedLeft) < 2,
        ghostWidth: Math.abs(ghostBox.width - laneWidth) < 1,
        sameTitle: ghost.getAttribute("aria-label") === lifted.getAttribute("aria-label"),
        inPlace: new DOMMatrix(getComputedStyle(lifted).transform).e === 0,
      };
    },
    [laneBox.x + 300, laneWidths[0]],
  );
  await shot("canvas-reorder");
  record(
    "a lane's title bar shows a hand, and lifting it floats a copy under the pointer while the lane waits dimmed",
    grabHand === "grab" &&
      lift.ghost &&
      lift.lifted &&
      lift.ghostOpacity === "0.85" &&
      lift.liftedOpacity === "0.35" &&
      lift.ghostFollows &&
      lift.ghostWidth &&
      lift.sameTitle &&
      lift.inPlace,
    `cursor ${grabHand}; ${JSON.stringify(lift)}`,
  );
  await page.mouse.move(grip + laneWidths[0] + 16 + 60, titleBox.y + 30, { steps: 6 });
  await page.waitForTimeout(250);
  const slid = await page.evaluate(
    (expected) =>
      Math.abs(
        new DOMMatrix(getComputedStyle(document.querySelector("[data-lifted]")).transform).e -
          expected,
      ) < 1,
    laneWidths[1] + 16,
  );
  record(
    "past a neighbour's centre the dimmed lane slides into the slot it would take",
    slid,
    `expected a slide of ${Math.round(laneWidths[1] + 16)}px`,
  );
  await page.mouse.move(grip + laneWidths[0] + laneWidths[1] + 32 + 60, titleBox.y + 30, {
    steps: 6,
  });
  await page.mouse.up();
  const labelsAfter = await canvas
    .locator("article")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  record(
    "a lane carried past its neighbours lands at the end of the row, and the copy is gone",
    labelsAfter.join("|") === [labelsBefore[1], labelsBefore[2], labelsBefore[0]].join("|") &&
      (await page.locator("[data-ghost]").count()) === 0,
    labelsAfter.map((label) => label.slice(0, 12)).join(" → "),
  );

  const handle = page.locator('[data-slot="resizable-handle"]');
  const handleBox = await handle.boundingBox();
  const panel = page.locator('[data-slot="resizable-panel"]').first();
  const widthBefore = (await panel.boundingBox()).width;
  // Grab it a fifth of the way down, not at a handle in the middle.
  const grabY = handleBox.y + handleBox.height * 0.2;
  await page.mouse.move(handleBox.x + handleBox.width / 2, grabY);
  await page.waitForTimeout(250);
  const handleHint = await handle.evaluate(
    (el, y) => ({
      opacity: getComputedStyle(el, "::before").opacity,
      centre: parseFloat(el.style.getPropertyValue("--hint-y")),
      y,
    }),
    grabY - handleBox.y,
  );
  record(
    "the thread/canvas divider shows the same hint at the pointer's height",
    handleHint.opacity === "1" && Math.abs(handleHint.centre - handleHint.y) < 2,
    `opacity ${handleHint.opacity}, centre ${Math.round(handleHint.centre)} for pointer at ${Math.round(handleHint.y)}`,
  );
  await page.mouse.down();
  await page.mouse.move(handleBox.x - 160, grabY, { steps: 8 });
  await page.mouse.up();
  const widthAfter = (await panel.boundingBox()).width;
  record(
    "the divider drags anywhere along its length",
    widthAfter < widthBefore - 100,
    `${Math.round(widthBefore)} → ${Math.round(widthAfter)}px`,
  );

  await page.reload({ waitUntil: "load" });
  await canvas.locator("article .thread-panel").first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
  const labelsReloaded = await canvas
    .locator("article")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  record(
    "lanes survive a reload in the order they were left, card lanes too",
    labelsReloaded.join("|") === labelsAfter.join("|"),
    labelsReloaded.map((label) => label.slice(0, 12)).join(" → "),
  );
  // A lane's title, and the main thread's, rename in place and keep the new name.
  const threadLane = canvas.locator("article").filter({ has: page.locator(".thread-title") });
  await threadLane.first().locator(".thread-title").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Weekend margins");
  await page.keyboard.press("Enter");
  const mainPanel = page.locator('[data-slot="resizable-panel"]').first();
  await mainPanel.locator(".thread-title").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Sales, last week");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: "load" });
  await canvas.locator("article .thread-panel").first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
  const laneTitle = await threadLane.first().locator(".thread-header").innerText();
  const mainTitle = await mainPanel.locator(".thread-header").innerText();
  record(
    "a lane's title and the main thread's rename in place and survive a reload",
    laneTitle === "Weekend margins" && mainTitle === "Sales, last week",
    `${laneTitle} / ${mainTitle}`,
  );

  const open = await canvas.locator("article").count();
  await canvas
    .getByRole("button", { name: /^Close / })
    .first()
    .click();
  await page.reload({ waitUntil: "load" });
  await canvas.locator("article .thread-panel").first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
  const closedOnce = (await canvas.locator("article").count()) === open - 1;
  for (let left = open - 1; left > 0; left--) {
    // oxlint-disable-next-line no-await-in-loop -- each close changes the row the next one reads
    await canvas
      .getByRole("button", { name: /^Close / })
      .first()
      .click();
  }
  await page.reload({ waitUntil: "load" });
  await canvas.getByText("Drag a text selection or card").waitFor({ timeout: 15_000 });
  record(
    "a closed lane stays closed",
    closedOnce && (await canvas.locator("article").count()) === 0,
  );

  await page.goto(`${BASE}/lab`, { waitUntil: "load" });
  await page.getByText("Useful answers.").waitFor({ timeout: 10_000 });
  await shot("lab");
  record("lab route renders the workbench", true);
  await chooseTheme("Dark");
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await page.waitForTimeout(300);
  await shot("lab-dark");
  await chooseTheme("Light");

  // The dev server serves the catalog's own modules, so the fragment comes from the real encoder.
  const fragment = await page.evaluate(async (root) => {
    const share = await import(`/@fs${root}/packages/catalog/src/share.ts`);
    const thread = await import(`/@fs${root}/packages/catalog/src/thread.ts`);
    return share.encodeCard({ v: 1, kind: "interactive", payload: thread.profitCard });
  }, ROOT);
  await page.goto(`${BASE}/share.html#${fragment}`, { waitUntil: "load" });
  await page.getByText("Shared from Kay.").waitFor({ timeout: 10_000 });
  await shot("share");
  record(
    "share.html renders the card from the fragment",
    await page.getByRole("heading", { name: "Last week's profit by day" }).isVisible(),
  );

  await page.goto(`${BASE}/share.html`, { waitUntil: "load" });
  await page.getByText("doesn’t contain a card").waitFor({ timeout: 10_000 });
  record("share.html without a card shows the honest notice", true);

  // The dev server answers an unknown path with a 404 status on purpose; that is not a defect.
  const errorsBeforeNotFound = errors.length;
  await page.goto(`${BASE}/nowhere`, { waitUntil: "load" });
  errors.splice(errorsBeforeNotFound);
  await shot("not-found");
  record(
    "unknown path shows the not-found page",
    await page.getByText("Page not found").isVisible(),
  );
} catch (error) {
  record("run", false, String(error));
  await shot("failure");
} finally {
  await browser.close();
}

record("no console errors", errors.length === 0, errors.join(" | ").slice(0, 300));
writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ results, errors }, null, 2));
console.log(`artifacts: ${OUT}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
