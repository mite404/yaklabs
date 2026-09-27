#!/usr/bin/env node
// Drive the web app the way a person would and keep the proof: screenshots, the agent's reply
// text, and every console error. Exits 1 on any failed step.
//
//   pnpm dev:web                                   # in one terminal
//   node apps/web/scripts/web-check.mjs [--base http://127.0.0.1:5173] [--out dir]
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { arg, chromium, ROOT } from "./harness.mjs";

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

// A step on a page of its own at `address`, a mock scenario, so no device data is touched. A
// throw fails that step alone, and the steps after it still run.
async function onOwnPage(step, address, options, measure) {
  const own = await browser.newPage({ viewport: { width: 1280, height: 900 }, ...options });
  own.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  own.on("pageerror", (error) => errors.push(String(error)));
  try {
    await own.goto(`${BASE}${address}`, { waitUntil: "load" });
    const { ok, detail } = await measure(own);
    record(step, ok, detail);
  } catch (error) {
    record(step, false, String(error).split("\n")[0]);
  } finally {
    await own.close();
  }
}

// The open threads, by the tablist the title bar names.
const tabsOf = (own) => own.getByRole("tablist", { name: "Open threads" }).getByRole("tab");

// The element with focus, as a screen reader would name it: its role, then its name.
const focusOn = (own) =>
  own.evaluate(() => {
    const at = document.activeElement;
    if (at === null || at === document.body) return "body";
    const role = at.getAttribute("role") ?? at.tagName.toLowerCase();
    return `${role} ${at.getAttribute("aria-label") ?? at.textContent.trim()}`;
  });

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

  const threadLanes = canvas.locator("article").filter({ has: page.locator(".thread-header") });
  await threadLanes.first().scrollIntoViewIfNeeded();
  const firstBar = await threadLanes.first().locator(".thread-header").boundingBox();
  // The bar's far end, past any title however long.
  const firstGrip = { x: firstBar.x + firstBar.width - 12, y: firstBar.y + firstBar.height / 2 };
  await page.mouse.move(firstGrip.x, firstGrip.y);
  await page.mouse.down();
  await page.mouse.move(firstGrip.x - 200, firstGrip.y + 30, { steps: 8 });
  await page.waitForTimeout(250);
  const liftedBeforeEscape = await page.locator("[data-lifted]").count();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  const heldAfterEscape = await page.locator("[data-ghost], [data-lifted]").count();
  await page.mouse.up();
  await page.waitForTimeout(250);
  const labelsEscaped = await canvas
    .locator("article")
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  record(
    "Escape puts a lifted lane back while the button is still down, and letting go moves nothing",
    liftedBeforeEscape === 1 &&
      heldAfterEscape === 0 &&
      labelsEscaped.join("|") === labelsAfter.join("|"),
    `lifted ${liftedBeforeEscape}, still up after Escape ${heldAfterEscape}; ${labelsEscaped.map((label) => label.slice(0, 12)).join(" → ")}`,
  );

  // A card's header inside a thread lane arms a carry, which claims its press with
  // preventDefault and lets it travel on. A stand-in header that claims its press the same way
  // shows whether the lane leaves a claimed press alone, as it must for the card to go alone.
  const claimed = threadLanes.first().locator(".thread-panel");
  await claimed.evaluate((panel) => {
    const standIn = document.createElement("header");
    standIn.className = "card-heading";
    standIn.dataset.claims = "";
    standIn.style.height = "40px";
    standIn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
    });
    panel.prepend(standIn);
  });
  const claimBox = await page.locator("[data-claims]").boundingBox();
  await page.mouse.move(claimBox.x + 40, claimBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(claimBox.x + 200, claimBox.y + 40, { steps: 6 });
  await page.waitForTimeout(250);
  const liftedByClaim = await page.locator("[data-lifted]").count();
  await page.mouse.up();
  await page.locator("[data-claims]").evaluate((el) => el.remove());
  record(
    "a press something in a lane has claimed, as a card's header does, never lifts the lane",
    liftedByClaim === 0,
    `${liftedByClaim} lifted`,
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

  // A device file that opens but cannot be read ends the start broken with its reason, never a
  // fresh starter over threads that are there. A page of its own, so its device is its own;
  // the pool keeps a 4096-byte header of its own before the database's bytes.
  const device = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await device.goto(`${BASE}/`, { waitUntil: "load" });
  await device.locator(".thread-panel").first().waitFor({ timeout: 20_000 });
  await device.goto(`${BASE}/share.html`, { waitUntil: "load" });
  const spoiled = await device.evaluate(async () => {
    const names = [];
    async function spoil(dir, at) {
      for await (const [name, entry] of dir.entries()) {
        if (entry.kind === "directory") {
          await spoil(entry, `${at}/${name}`);
          continue;
        }
        if ((await entry.getFile()).size <= 8192) continue;
        const writable = await entry.createWritable({ keepExistingData: true });
        await writable.seek(4096);
        await writable.write(new Uint8Array(4096).fill(0x5a));
        await writable.close();
        names.push(`${at}/${name}`);
      }
    }
    await spoil(await navigator.storage.getDirectory(), "");
    return names;
  });
  await device.goto(`${BASE}/`, { waitUntil: "load" });
  const notice = device.getByText("Your threads could not be opened", { exact: true });
  await notice.waitFor({ timeout: 20_000 });
  const reason = await notice.locator("xpath=..").innerText();
  await device.getByRole("main").getByRole("button", { name: "Try again" }).click();
  await notice.waitFor({ timeout: 20_000 });
  await device.screenshot({ path: path.join(OUT, "device-broken.png") });
  record(
    "a device file that cannot be read says why and offers Try again, which tries again",
    spoiled.length === 1 && reason.includes("could not be brought up to date"),
    `${spoiled.length} file spoiled; ${reason.replaceAll(/\s+/g, " ").slice(0, 140)}`,
  );
  await device.close();

  await onOwnPage(
    "the tab strip holds only tabs, and a tab's close button still closes it",
    "/t/t-005?scenario=demo",
    {},
    async (own) => {
      const strip = own.getByRole("tablist", { name: "Open threads" });
      await tabsOf(own).first().waitFor({ timeout: 15_000 });
      const strays = await strip.getByRole("button").count();
      await strip.getByRole("tab", { name: "Last week's sales" }).hover();
      await own.waitForTimeout(100);
      const closer = own.getByRole("button", { name: "Close Last week's sales" });
      const shown = await closer.evaluate((el) => getComputedStyle(el).opacity);
      await closer.click();
      await own.waitForTimeout(300);
      const left = await tabsOf(own).allInnerTexts();
      return {
        ok: strays === 0 && shown === "1" && left.join() === "Service desk weekly review",
        detail: `${strays} buttons in the tablist; close shown on hover ${shown}; tabs left ${left.join(", ")}`,
      };
    },
  );

  await onOwnPage(
    "closing a focused tab by key hands focus to the tab that takes its place, then to New thread",
    "/t/t-005?scenario=demo",
    {},
    async (own) => {
      await tabsOf(own).first().waitFor({ timeout: 15_000 });
      await tabsOf(own).filter({ hasText: "Service desk weekly review" }).focus();
      await own.keyboard.press("Delete");
      await own.waitForURL(/\/t\/t-001/);
      const next = await focusOn(own);
      if (next.startsWith("tab ")) {
        await own.keyboard.press("Delete");
        await own.getByText("Nothing open").waitFor();
      }
      const none = await focusOn(own);
      return {
        ok: next === "tab Last week's sales" && none === "button New thread",
        detail: `focus after closing the selected tab: ${next}; after closing the last: ${none}`,
      };
    },
  );

  await onOwnPage(
    "at phone width every tab, New thread and Account stay on screen, and New thread takes a tap",
    "/t/t-005?scenario=demo",
    { viewport: { width: 390, height: 844 } },
    async (own) => {
      await tabsOf(own).first().waitFor({ timeout: 15_000 });
      const look = await own.evaluate(() => {
        const bar = document.querySelector('header[data-slot="title-bar"]');
        // On screen, and a tap at its centre lands on it: nothing clips or covers it.
        const [plus, account, ...tabs] = [
          bar.querySelector('[aria-label="New thread"]'),
          bar.querySelector('[aria-label="Account"]'),
          ...bar.querySelectorAll('[role="tab"]'),
        ].map((el) => {
          const rect = el.getBoundingClientRect();
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth && el.contains(hit);
        });
        return { tabs, plus, account, spill: bar.scrollWidth - bar.clientWidth };
      });
      await own.screenshot({ path: path.join(OUT, "title-bar-phone.png") });
      return {
        ok:
          look.tabs.length === 2 &&
          look.tabs.every(Boolean) &&
          look.plus &&
          look.account &&
          look.spill <= 0,
        detail: JSON.stringify(look),
      };
    },
  );

  await onOwnPage(
    "the sidebar is a navigation landmark holding the rail and the projects",
    "/t/t-005?scenario=demo",
    {},
    async (own) => {
      await tabsOf(own).first().waitFor({ timeout: 15_000 });
      const nav = own.getByRole("navigation", { name: "Sidebar" });
      const held = {
        kay: await nav.getByRole("link", { name: "Kay", exact: true }).count(),
        lab: await nav.getByRole("link", { name: "Lab", exact: true }).count(),
        project: await nav.getByRole("button", { name: "Demo store", exact: true }).count(),
      };
      return { ok: Object.values(held).every((n) => n === 1), detail: JSON.stringify(held) };
    },
  );

  await onOwnPage(
    "Toggle sidebar says whether the sidebar is expanded, and names what it controls",
    "/t/t-005?scenario=demo",
    {},
    async (own) => {
      await tabsOf(own).first().waitFor({ timeout: 15_000 });
      const toggle = own.getByRole("button", { name: "Toggle sidebar" });
      const state = () =>
        toggle.evaluate((el) => ({
          expanded: el.getAttribute("aria-expanded"),
          controls:
            document.getElementById(el.getAttribute("aria-controls"))?.getAttribute("aria-label") ??
            null,
        }));
      const before = await state();
      await toggle.click();
      const after = await state();
      return {
        ok:
          before.expanded === "true" && after.expanded === "false" && before.controls === "Sidebar",
        detail: `before ${JSON.stringify(before)}, after ${JSON.stringify(after)}`,
      };
    },
  );

  await onOwnPage(
    "on a phone, choosing a thread in the sidebar sheet closes the sheet",
    "/t/t-005?scenario=demo",
    { viewport: { width: 390, height: 844 } },
    async (own) => {
      await tabsOf(own).first().waitFor({ timeout: 15_000 });
      await own.getByRole("button", { name: "Toggle sidebar" }).click();
      await own.getByRole("dialog").getByRole("link", { name: "Last week's sales" }).click();
      await own.waitForURL(/\/t\/t-001/);
      await own.waitForTimeout(600);
      const sheets = await own.getByRole("dialog").count();
      return { ok: sheets === 0, detail: `${sheets} sheet open after choosing a thread` };
    },
  );

  await onOwnPage(
    "the collapsed rail's icons sit centred in their squares",
    "/t/t-005?scenario=demo",
    { viewport: { width: 1024, height: 768 } },
    async (own) => {
      await tabsOf(own).first().waitFor({ timeout: 15_000 });
      const offsets = await own.locator('[data-slot="sidebar"]').evaluate((side) =>
        ["Kay", "Documentation", "Lab"].map((name) => {
          const link = [...side.querySelectorAll("a")].find(
            (a) => (a.getAttribute("aria-label") ?? a.textContent.trim()) === name,
          );
          const square = link.getBoundingClientRect();
          const glyph = link.querySelector("svg").getBoundingClientRect();
          return [
            glyph.left + glyph.width / 2 - (square.left + square.width / 2),
            glyph.top + glyph.height / 2 - (square.top + square.height / 2),
          ];
        }),
      );
      return {
        ok: offsets.flat().every((offset) => Math.abs(offset) < 0.5),
        detail: `icon centre minus square centre (x, y): ${offsets.map((pair) => pair.join(", ")).join("; ")}`,
      };
    },
  );

  await onOwnPage(
    "Toggle sidebar looks the same at rest whether the sidebar is open or not",
    "/t/t-005?scenario=demo",
    {},
    async (own) => {
      await tabsOf(own).first().waitFor({ timeout: 15_000 });
      const toggle = own.getByRole("button", { name: "Toggle sidebar" });
      const look = async () => {
        await own.mouse.move(900, 600);
        await own.waitForTimeout(250);
        return toggle.evaluate((el) => {
          const style = getComputedStyle(el);
          return `${style.backgroundColor} ${style.color}`;
        });
      };
      const expanded = await look();
      await toggle.click();
      const collapsed = await look();
      return {
        ok: expanded === collapsed,
        detail: `expanded ${expanded}; collapsed ${collapsed}`,
      };
    },
  );

  await onOwnPage(
    "a cut sidebar row shows its whole name on the first hover and on keyboard focus",
    "/t/t-001?scenario=long",
    {},
    async (own) => {
      const rows = own.locator('[data-slot="sidebar"] [data-thread="main"]');
      await rows.first().waitFor({ timeout: 15_000 });
      const tips = own.locator('[data-slot="tooltip-content"]');
      const cut = await rows.evaluateAll((els) =>
        els.slice(0, 2).map((el) => {
          const label = el.querySelector("[data-label]");
          return label.scrollWidth > label.clientWidth;
        }),
      );
      const [first, second] = [await rows.nth(0).innerText(), await rows.nth(1).innerText()];
      await rows.nth(0).hover();
      await own.waitForTimeout(600);
      const onHover = await tips.allInnerTexts();
      await own.mouse.move(900, 450);
      await own.waitForTimeout(400);
      await rows.nth(1).focus();
      await own.keyboard.press("Shift+Tab");
      await own.keyboard.press("Tab");
      await own.waitForTimeout(600);
      const onFocus = await tips.allInnerTexts();
      return {
        ok: cut.every(Boolean) && onHover.includes(first) && onFocus.includes(second),
        detail: `rows cut ${cut.join()}; tooltips on the first hover ${JSON.stringify(onHover)}, on focus ${JSON.stringify(onFocus)}`,
      };
    },
  );

  await onOwnPage(
    "a project name with an unbroken word wraps inside its tooltip",
    "/t/t-001?scenario=long",
    {},
    async (own) => {
      const row = own
        .locator('[data-slot="sidebar"] button[aria-expanded]')
        .filter({ hasText: "Supplierinvoice" })
        .first();
      await row.waitFor({ timeout: 15_000 });
      await row.scrollIntoViewIfNeeded();
      await row.hover();
      const tip = own
        .locator('[data-slot="tooltip-content"]')
        .filter({ hasText: "Supplierinvoice" });
      await tip.waitFor({ timeout: 3000 });
      const fit = await tip.evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth }));
      await own.screenshot({ path: path.join(OUT, "tooltip-unbroken.png") });
      return { ok: fit.scroll <= fit.client, detail: JSON.stringify(fit) };
    },
  );

  await onOwnPage(
    "New project hands focus to the new thread's row in the sidebar",
    "/?scenario=empty",
    {},
    async (own) => {
      await own.getByRole("button", { name: "New project" }).focus();
      await own.keyboard.press("Enter");
      await own.waitForURL(/\/t\//);
      await own.waitForTimeout(500);
      const at = await own.evaluate(() => ({
        current: document.activeElement.getAttribute("aria-current"),
        sidebar: document.activeElement.closest('[data-slot="sidebar"]') !== null,
      }));
      return {
        ok: at.current === "page" && at.sidebar,
        detail: `focus on ${await focusOn(own)}, current ${at.current}, in the sidebar ${at.sidebar}`,
      };
    },
  );

  await onOwnPage(
    "the data marker is a button whose accessible description is its hint",
    "/t/t-005?scenario=demo",
    {},
    async (own) => {
      await tabsOf(own).first().waitFor({ timeout: 15_000 });
      const cdp = await own.context().newCDPSession(own);
      const { root } = await cdp.send("DOM.getDocument");
      const { nodeId } = await cdp.send("DOM.querySelector", {
        nodeId: root.nodeId,
        selector: ':has(> [data-slot="data-marker"])',
      });
      const [node] = (await cdp.send("Accessibility.getPartialAXTree", { nodeId })).nodes;
      const read = {
        role: node.role?.value,
        name: node.name?.value,
        description: node.description?.value ?? "",
      };
      return {
        ok:
          read.role === "button" &&
          read.name === "Mock: demo" &&
          read.description.includes("Nothing here is saved"),
        detail: JSON.stringify(read),
      };
    },
  );

  await onOwnPage(
    "a thread page and /lab each have exactly one main landmark",
    "/t/t-005?scenario=demo",
    {},
    async (own) => {
      await tabsOf(own).first().waitFor({ timeout: 15_000 });
      const onThread = await own.getByRole("main").count();
      await own.goto(`${BASE}/lab?scenario=demo`, { waitUntil: "load" });
      await own.getByText("Useful answers.").waitFor({ timeout: 10_000 });
      const onLab = await own.getByRole("main").count();
      return {
        ok: onThread === 1 && onLab === 1,
        detail: `${onThread} on a thread, ${onLab} on /lab`,
      };
    },
  );

  await onOwnPage(
    "the browser's Simulated badge clears 4.5:1 on the address field, light and dark",
    "/t/t-005?scenario=demo",
    {},
    async (own) => {
      const badge = own
        .locator('[role="tabpanel"]:not([inert])')
        .getByRole("region", { name: "Browser" })
        .getByText("Simulated", { exact: true });
      const ratio = async (colorScheme) => {
        await own.emulateMedia({ colorScheme });
        await own.reload({ waitUntil: "load" });
        await badge.waitFor({ timeout: 15_000 });
        return badge.evaluate((el) => {
          // Every fill under the badge's centre, painted bottom up onto one pixel, gives the
          // colour its text is read against.
          const rect = el.getBoundingClientRect();
          const under = document.elementsFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          const pixel = document.createElement("canvas").getContext("2d");
          const paint = (color) => {
            pixel.fillStyle = color;
            pixel.fillRect(0, 0, 1, 1);
            return [...pixel.getImageData(0, 0, 1, 1).data];
          };
          for (const node of [...under.toReversed(), el]) {
            paint(getComputedStyle(node).backgroundColor);
          }
          const ground = paint("transparent");
          const ink = paint(getComputedStyle(el).color);
          const [bright, deep] = [ink, ground]
            .map((rgba) => {
              const [r, g, b] = rgba.slice(0, 3).map((c) => {
                const s = c / 255;
                return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
              });
              return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            })
            .toSorted((a, b) => b - a);
          return Math.round(((bright + 0.05) / (deep + 0.05)) * 100) / 100;
        });
      };
      const onLight = await ratio("light");
      const onDark = await ratio("dark");
      return {
        ok: onLight >= 4.5 && onDark >= 4.5,
        detail: `light ${onLight}:1, dark ${onDark}:1`,
      };
    },
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
