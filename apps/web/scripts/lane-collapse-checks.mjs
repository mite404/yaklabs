// Checks for collapsible lanes (ADR-124): the strip's look in both themes, the drag by any part
// of it, the state kept across a reload, and the keyboard and screen reader's way in.
import { canvasOf, laneTitles, makeLane } from "./canvas-checks.mjs";
import { BASE, luminance, shotPath } from "./lever.mjs";

// Long enough to outgrow a strip down a 900px window, so its end has to give way to an ellipsis.
const LONG_TITLE =
  "Why supplier invoices and deliveries disagree at the northern warehouse, week by week, since June, and what the stores could do about it before the quarter closes";
const STRIP_PX = 32;

const near = (a, b) => Math.abs(a - b) <= 1;
// A box grown by 2px each way, so a measure of its ink takes in the paper around it.
const pad = (box) => ({
  x: box.x - 2,
  y: box.y - 2,
  width: box.width + 4,
  height: box.height + 4,
});
const NO_INK = { min: 255, max: 0, mean: 0 };
const laneNamed = (page, title) =>
  canvasOf(page).locator(`:scope > article[aria-label="${title.replaceAll('"', '\\"')}"]`);

// The app in `theme` in a fresh context, ready once a thread panel is on screen. The context is
// the page's own, so a reload keeps what the device stored and nothing else sees it.
async function openThemed(browser, theme = "light") {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.addInitScript((chosen) => {
    localStorage.setItem("theme", chosen);
  }, theme);
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.locator(".thread-panel").first().waitFor({ timeout: 20_000 });
  return { page, errors, close: () => context.close() };
}

// What a collapsed lane shows, measured: the strip's box against the lane's, the title's
// writing mode and clip, the grip's opacity, the buttons it offers and what it hides.
function stripLook(lane) {
  return lane.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const strip = el.querySelector("[data-lane-strip]");
    const title = el.querySelector("[data-lane-strip-title]");
    const grip = el.querySelector("[data-lane-strip-grip]");
    const stripBox = strip?.getBoundingClientRect();
    const titleStyle = title && getComputedStyle(title);
    const buttons = [...el.querySelectorAll("button")]
      .filter((button) => button.offsetWidth > 0)
      .map((button) => button.getAttribute("aria-label") ?? button.textContent.trim());
    return {
      width: box.width,
      stripTop: stripBox ? stripBox.top - box.top : -1,
      stripBottom: stripBox ? box.bottom - stripBox.bottom : -1,
      stripWidth: stripBox?.width ?? 0,
      text: title?.textContent ?? "",
      writing: titleStyle?.writingMode ?? "",
      overflow: titleStyle?.textOverflow ?? "",
      clipped: title ? title.scrollHeight > title.clientHeight + 1 : false,
      tall: title
        ? title.getBoundingClientRect().height > title.getBoundingClientRect().width
        : false,
      gripOpacity: grip ? getComputedStyle(grip).opacity : "",
      gripBox: grip?.getBoundingClientRect().toJSON() ?? null,
      titleBox: title?.getBoundingClientRect().toJSON() ?? null,
      contentShown: [...el.querySelectorAll(".thread-panel, .card")].some(
        (part) => part.offsetWidth > 0,
      ),
      buttons,
    };
  });
}

// One theme's strip: a long-titled lane collapsed, measured at rest with the pointer away.
async function stripIn(browser, theme) {
  const { page, close } = await openThemed(browser, theme);
  await makeLane(page, LONG_TITLE);
  const lane = laneNamed(page, LONG_TITLE);
  await lane.getByRole("button", { name: "Collapse lane" }).click();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(300);
  const look = await stripLook(lane);
  const gripInk = look.gripBox ? await luminance(page, pad(look.gripBox)) : NO_INK;
  const titleInk = look.titleBox
    ? await luminance(page, { ...look.titleBox, height: Math.min(look.titleBox.height, 120) })
    : NO_INK;
  await lane.screenshot({ path: shotPath(`P14-strip-${theme}`) });
  await page.screenshot({ path: shotPath(`P14-canvas-${theme}`) });
  await close();
  // Ink against the strip: dark marks on light paper, light marks on dark paper.
  const marked = (ink) => (theme === "light" ? ink.mean - ink.min >= 60 : ink.max - ink.mean >= 60);
  const ok =
    near(look.width, STRIP_PX) &&
    near(look.stripWidth, STRIP_PX) &&
    look.stripTop >= 0 &&
    look.stripBottom <= 1 &&
    look.text === LONG_TITLE &&
    look.writing === "vertical-rl" &&
    look.overflow === "ellipsis" &&
    look.clipped &&
    look.tall &&
    look.gripOpacity === "1" &&
    marked(gripInk) &&
    marked(titleInk) &&
    !look.contentShown &&
    JSON.stringify(look.buttons) === JSON.stringify(["Expand lane"]);
  return {
    ok,
    note: `${theme}: lane ${Math.round(look.width)}px, strip ${Math.round(look.stripWidth)}px from ${Math.round(look.stripTop)}px to ${Math.round(look.stripBottom)}px off the foot; title ${look.writing} ${look.overflow} clipped ${look.clipped}; grip opacity ${look.gripOpacity} ink ${JSON.stringify(gripInk)}; title ink ${JSON.stringify(titleInk)}; content shown ${look.contentShown}; buttons ${look.buttons.join("|")}`,
  };
}

// Presses at `from`, travels to `to` in steps, and reports what the page showed on the way.
async function dragStrip(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 4, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.waitForTimeout(150);
  const during = await page.evaluate(() => {
    const ghost = document.querySelector(".lane-ghost");
    return {
      dragging: document.documentElement.dataset.dragging ?? "",
      ghostWidth: ghost ? Math.round(ghost.getBoundingClientRect().width) : 0,
      ghostShadow: ghost ? getComputedStyle(ghost).filter : "none",
      ghostGrip: ghost?.querySelector("[data-lane-strip-grip]")?.offsetWidth ?? 0,
      lifted: document.querySelector("article[data-lifted]")?.getAttribute("aria-label") ?? "",
    };
  });
  await page.screenshot({ path: shotPath("P15-carrying") });
  await page.mouse.up();
  await page.waitForTimeout(500);
  return during;
}

/** Collapsible lanes (P14 to P17). */
export const laneCollapseChecks = {
  async P14(browser) {
    const results = await Promise.all(["light", "dark"].map((theme) => stripIn(browser, theme)));
    return {
      ok: results.every((each) => each.ok),
      detail: results.map((each) => each.note).join("; "),
    };
  },

  async P15(browser) {
    const { page, close } = await openThemed(browser);
    await makeLane(page, "First");
    await makeLane(page, "Second");
    await canvasOf(page).evaluate((el) => (el.scrollLeft = 0));
    const card = laneNamed(page, "First");
    await card.getByRole("button", { name: "Collapse lane" }).click();
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
    const strip = await card.boundingBox();
    const second = await laneNamed(page, "Second").boundingBox();
    const before = await laneTitles(page);
    // A press on the title, the part that renames in an open lane, still takes the strip.
    const title = await card.locator("[data-lane-strip-title]").boundingBox();
    const during = await dragStrip(
      page,
      { x: title.x + title.width / 2, y: title.y + 40 },
      { x: second.x + second.width - 20, y: strip.y + strip.height / 2 },
    );
    const moved = await laneTitles(page);
    // And a press low on the strip, where there is nothing but the strip itself.
    const low = await card.boundingBox();
    const first = await laneNamed(page, "Second").boundingBox();
    await dragStrip(
      page,
      { x: low.x + low.width / 2, y: low.y + low.height - 30 },
      { x: first.x + 20, y: low.y + low.height / 2 },
    );
    const back = await laneTitles(page);
    // The expand button keeps its job: a click opens the lane and moves nothing.
    await card.getByRole("button", { name: "Expand lane" }).click();
    await page.waitForTimeout(300);
    const expanded = await card.getByRole("button", { name: "Collapse lane" }).count();
    const afterClick = await laneTitles(page);
    await close();
    const ok =
      during.dragging === "lane" &&
      during.lifted === "First" &&
      near(during.ghostWidth, STRIP_PX) &&
      during.ghostShadow.includes("drop-shadow") &&
      during.ghostGrip > 0 &&
      JSON.stringify(moved) === JSON.stringify(before.toReversed()) &&
      JSON.stringify(back) === JSON.stringify(before) &&
      expanded === 1 &&
      JSON.stringify(afterClick) === JSON.stringify(before);
    return {
      ok,
      detail: `while carried: ${JSON.stringify(during)}; by the title ${before.join(" | ")} → ${moved.join(" | ")}; by the foot → ${back.join(" | ")}; expand click opens ${expanded === 1}, order ${afterClick.join(" | ")}`,
    };
  },

  async P16(browser) {
    const { page, close } = await openThemed(browser);
    await makeLane(page, "Folded too");
    await makeLane(page, "Kept narrow");
    const lane = laneNamed(page, "Kept narrow");
    const gap = canvasOf(page).getByRole("separator", { name: "Resize or move Kept narrow" });
    await gap.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(300);
    const open = Math.round((await lane.boundingBox()).width);
    await lane.getByRole("button", { name: "Collapse lane" }).click();
    await laneNamed(page, "Folded too").getByRole("button", { name: "Collapse lane" }).click();
    await page.waitForTimeout(300);
    const collapsed = () => canvasOf(page).getByRole("button", { name: "Expand lane" }).count();
    const before = await collapsed();
    await page.reload({ waitUntil: "load" });
    await lane.waitFor({ timeout: 20_000 });
    await page.waitForTimeout(500);
    const after = await collapsed();
    const stripWidth = Math.round((await lane.boundingBox()).width);
    await lane.getByRole("button", { name: "Expand lane" }).click();
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: "load" });
    await lane.waitFor({ timeout: 20_000 });
    await page.waitForTimeout(500);
    const reopened = Math.round((await lane.boundingBox()).width);
    const stillCollapsed = await collapsed();
    await close();
    return {
      ok:
        before === 2 &&
        after === 2 &&
        near(stripWidth, STRIP_PX) &&
        reopened === open &&
        stillCollapsed === 1,
      detail: `collapsed ${before} → ${after} after a reload, strip ${stripWidth}px; expanded and reloaded at ${reopened}px (was ${open}px) with ${stillCollapsed} still collapsed`,
    };
  },

  async P17(browser) {
    const { page, close } = await openThemed(browser);
    await makeLane(page, "Before it");
    await makeLane(page, "By keyboard");
    const lane = laneNamed(page, "By keyboard");
    const focusedName = () =>
      page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
    await lane.getByRole("button", { name: "Collapse lane" }).focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const afterEnter = await focusedName();
    const tree = await lane.ariaSnapshot();
    const gap = canvasOf(page).getByRole("separator", { name: "Move By keyboard" });
    const gapShown = await gap.count();
    const titles = await laneTitles(page);
    await gap.focus();
    await page.keyboard.press("Shift+ArrowLeft");
    await page.waitForTimeout(400);
    const moved = await laneTitles(page);
    const widthAfterArrow = Math.round((await lane.boundingBox()).width);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
    const stripAfterArrow = Math.round((await lane.boundingBox()).width);
    await lane.getByRole("button", { name: "Expand lane" }).focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);
    const afterSpace = await focusedName();
    await close();
    const ok =
      afterEnter === "Expand lane" &&
      tree.includes('article "By keyboard"') &&
      tree.includes('button "Expand lane"') &&
      tree.includes("By keyboard") &&
      gapShown === 1 &&
      moved.indexOf("By keyboard") === titles.indexOf("By keyboard") - 1 &&
      near(widthAfterArrow, STRIP_PX) &&
      near(stripAfterArrow, STRIP_PX) &&
      afterSpace === "Collapse lane";
    return {
      ok,
      detail: `focus after Enter "${afterEnter}", after Space "${afterSpace}"; tree ${JSON.stringify(tree.replaceAll(/\s+/g, " ").slice(0, 120))}; gap named "Move By keyboard" ${gapShown === 1}; Shift+ArrowLeft ${titles.join(" | ")} → ${moved.join(" | ")}; ArrowRight leaves the strip ${stripAfterArrow}px`,
    };
  },
};
