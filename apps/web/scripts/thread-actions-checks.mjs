// oxlint-disable no-await-in-loop -- a check drives one browser step at a time, in order
// The thread menu's checks (ADR-126 to ADR-130) on the real app's demo scenario: every check
// opens its own browser context, so no check sees another's data.
import { BASE, openApp } from "./lever.mjs";

// A thread header's padding and its rule: its height is its title's line and these, so actions
// that make it taller show as a difference.
const HEADER_FRAME_PX = 14 * 2 + 1;
// The menu's items, in Ethan's order (ADR-126).
const ITEMS = ["Copy thread URL", "Share thread", "Pin thread", "Snooze", "Archive", "Delete"];
const DEMO = `${BASE}/?scenario=demo`;

const shownPanel = (page) => page.locator('[role="tabpanel"]:not([inert]) .thread-panel').first();
export const headerOf = (page) => shownPanel(page).locator(".thread-header");
const sidebarOf = (page) => page.locator('[data-slot="sidebar"]');
const rowsOf = (page) => sidebarOf(page).locator("[data-thread]");
const rowTitles = async (page) =>
  Array.from(await rowsOf(page).locator("[data-label]").allInnerTexts(), (text) =>
    String(text).trim(),
  );
const serviceDesk = "Service desk weekly review";

// The demo's desktop, ready once its sidebar has rows and a thread shows.
export async function openDemo(browser, options = {}) {
  const { page } = await openApp(browser, DEMO, options);
  await sidebarOf(page).locator("[data-thread]").first().waitFor();
  return page;
}

/**
 * Opens a thread from its sidebar row and waits until its own tab panel is the one shown, with
 * its turns in: for a moment after the address changes, the old panel is not inert yet, and a
 * locator resolved then would hold the old thread's controls.
 */
export async function openThread(page, title) {
  await rowsOf(page).filter({ hasText: title }).first().click();
  const panel = page.locator(`[role="tabpanel"]:not([inert])[aria-label="${title}"]`);
  await panel.locator(".compose-box textarea").first().waitFor();
}

// Opens the shown thread's "⋯" and picks an item by name.
export async function pick(page, name) {
  await headerOf(page).getByRole("button", { name: "Thread actions" }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

/** The open menu's items by their own words, without a status beside them ("Private"). */
export const menuItems = (page) =>
  page.getByRole("menuitem").evaluateAll((items) =>
    items.map((item) =>
      [...item.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join("")
        .trim(),
    ),
  );

// A row's box and ink, found by the title it shows.
async function rowOf(page, title) {
  const row = rowsOf(page).filter({ hasText: title }).first();
  return {
    row,
    marks: Array.from(
      await row.locator("[data-mark]").evaluateAll((els) => els.map((el) => el.dataset.mark)),
      String,
    ),
    ink: String(await row.evaluate((el) => getComputedStyle(el).color)),
  };
}

/** The checks, keyed A1 to A8, each resolving to { ok, detail }; Share's are in share-checks.mjs. */
export const threadActionChecks = {
  // The desktop header carries the "⋯" with the six items, and is no taller than its title.
  async A1(browser) {
    const page = await openDemo(browser);
    const height = (await headerOf(page).boundingBox()).height;
    const title = (await headerOf(page).locator("h2").boundingBox()).height;
    await headerOf(page).getByRole("button", { name: "Thread actions" }).click();
    const items = await menuItems(page);
    const ok =
      JSON.stringify(items) === JSON.stringify(ITEMS) &&
      Math.abs(height - (title + HEADER_FRAME_PX)) <= 0.01;
    return {
      ok,
      detail: `items [${items.join(" | ")}]; header ${height}px = title ${title}px + ${HEADER_FRAME_PX}px`,
    };
  },

  // Pin lifts the thread to the top of its project and marks the title bar; the view stays;
  // pressing the mark unpins, and the row goes back where it was.
  async A2(browser) {
    const page = await openDemo(browser, { ready: ".thread-panel" });
    await openThread(page, "Last week's sales");
    const url = page.url();
    const before = await rowTitles(page);
    await pick(page, "Pin thread");
    const mark = headerOf(page).getByRole("button", { name: "Unpin thread" });
    await mark.waitFor();
    const pinned = await rowTitles(page);
    const pinnedRow = await rowOf(page, "Last week's sales");
    await mark.click();
    await mark.waitFor({ state: "detached" });
    const after = await rowTitles(page);
    const ok =
      pinned.indexOf("Last week's sales") < pinned.indexOf("Refund audit") &&
      before.indexOf("Last week's sales") > before.indexOf("Refund audit") &&
      JSON.stringify(after) === JSON.stringify(before) &&
      pinnedRow.marks.includes("pinned") &&
      page.url() === url;
    return {
      ok,
      detail: `before [${before.join()}]; pinned [${pinned.join()}] marks ${pinnedRow.marks.join()}; after [${after.join()}]; view kept ${page.url() === url}`,
    };
  },

  // Copy thread URL puts the whole address, scenario kept, on the clipboard.
  async A3(browser) {
    const page = await openDemo(browser);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await pick(page, "Copy thread URL");
    await page.getByText("Thread URL copied").waitFor();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const ok = copied === page.url() && /\/t\/[^/?]+\?scenario=demo$/.test(copied);
    return { ok, detail: `copied ${copied}; page ${page.url()}` };
  },

  // Archive settles the thread to the bottom of its project, dimmed, with a filebox; Unarchive
  // brings it back; the view stays.
  async A4(browser) {
    const page = await openDemo(browser);
    await openThread(page, "Refund audit");
    const url = page.url();
    await pick(page, "Archive");
    await page.getByText("Archived “Refund audit”").waitFor();
    const titles = await rowTitles(page);
    // Below the other main and its sub-threads, still in its own project; the view stays.
    const last =
      titles.indexOf("Refund audit") > titles.indexOf("Why is Tuesday quiet?") &&
      titles.indexOf("Refund audit") < titles.indexOf(serviceDesk) &&
      page.url() === url;
    // Dimmed only while it is not the thread open, so it is read from another thread.
    await openThread(page, "Last week's sales");
    const archived = await rowOf(page, "Refund audit");
    const live = await rowOf(page, serviceDesk);
    await openThread(page, "Refund audit");
    await pick(page, "Unarchive");
    await rowsOf(page)
      .filter({ hasText: "Refund audit" })
      .locator('[data-mark="archived"]')
      .waitFor({ state: "detached" });
    // --faint-ink, #64645e, against the soft ink of a live row (ADR-129).
    const ok =
      last &&
      archived.marks.includes("archived") &&
      archived.ink === "rgb(100, 100, 94)" &&
      live.ink === "rgb(86, 86, 80)";
    return {
      ok,
      detail: `order [${titles.join()}]; archived ink ${archived.ink} vs ${live.ink}; marks ${archived.marks.join()}`,
    };
  },

  // Snooze opens the ask-user card with the fallbacks; a tile snoozes, the row gets a clock and
  // stays in place, and the menu says when it wakes.
  async A5(browser) {
    const page = await openDemo(browser);
    const before = await rowTitles(page);
    await pick(page, "Snooze");
    const card = shownPanel(page).getByRole("region", { name: "Snooze" });
    await card.waitFor();
    const tiles = (await card.locator(".awaiting-option").allInnerTexts()).map((t) => t.trim());
    const focused = await page.evaluate(() => document.activeElement?.textContent ?? "");
    await card.getByRole("radio", { name: /In 1 hour/ }).click();
    await card.getByRole("button", { name: "Submit" }).click();
    await card.waitFor({ state: "detached" });
    const row = await rowOf(page, serviceDesk);
    await headerOf(page).getByRole("button", { name: "Thread actions" }).click();
    const snooze = (await page.getByRole("menuitem", { name: /^Snooze/ }).innerText()).trim();
    // Its name as a screen reader hears it: the wake time joined by a comma.
    const named = await page.getByRole("menuitem", { name: /^Snooze, \w{3} \d+:\d{2}$/ }).count();
    const ok =
      JSON.stringify(tiles) ===
        JSON.stringify(["In 1 hour", "Tomorrow", "Next week", "Keep it awake"]) &&
      row.marks.includes("snoozed") &&
      JSON.stringify(await rowTitles(page)) === JSON.stringify(before) &&
      named === 1 &&
      focused.includes("In 1 hour");
    return {
      ok,
      detail: `tiles [${tiles.join()}]; focus on "${focused.trim()}"; marks ${row.marks.join()}; menu "${snooze.replaceAll("\n", " ")}"`,
    };
  },

  // A date the thread names leads the card's tiles.
  async A6(browser) {
    const page = await openDemo(browser);
    const compose = shownPanel(page).locator(".compose-box textarea");
    await compose.fill("Let's look at this again by Friday.");
    await compose.press("Enter");
    await shownPanel(page).getByText("Let's look at this again by Friday.").waitFor();
    await page.waitForTimeout(500);
    await pick(page, "Snooze");
    const card = shownPanel(page).getByRole("region", { name: "Snooze" });
    await card.waitFor();
    const tiles = (await card.locator(".awaiting-option").allInnerTexts()).map((t) => t.trim());
    const detail = (await card.locator(".awaiting-detail").first().innerText()).trim();
    const ok =
      /^Friday \d+ \w+$/.test(tiles[0] ?? "") && detail.startsWith("Mentioned in the thread");
    return { ok, detail: `tiles [${tiles}]; first detail "${detail}"` };
  },

  // Delete takes the thread off screen and out of the sidebar at once; Undo brings it back and
  // returns to it.
  async A7(browser) {
    const page = await openDemo(browser);
    const url = page.url();
    await pick(page, "Delete");
    await page.getByText(`Deleted “${serviceDesk}”`).waitFor();
    const gone = !(await rowTitles(page)).includes(serviceDesk);
    const moved = page.url() !== url;
    await page.getByRole("button", { name: "Undo" }).click();
    await page.waitForURL(url, { timeout: 10_000 });
    await rowsOf(page).filter({ hasText: serviceDesk }).waitFor();
    return {
      ok: gone && moved,
      detail: `gone ${gone}; left the page ${moved}; back at ${page.url()}`,
    };
  },

  // On a phone the one "⋯" sits in the bar's top row and holds the same items; the thread's own
  // title bar has none.
  async A8(browser) {
    const page = await openDemo(browser, { ready: '[data-slot="title-bar"]' });
    await page.setViewportSize({ width: 390, height: 844 });
    const bar = page.locator('header[data-slot="title-bar"]');
    await bar.getByRole("button", { name: "Thread actions" }).click();
    const items = await menuItems(page);
    await page.keyboard.press("Escape");
    const inHeader = await page
      .locator(".thread-header")
      .getByRole("button", { name: "Thread actions" })
      .count();
    const ok = JSON.stringify(items) === JSON.stringify(ITEMS) && inHeader === 0;
    return { ok, detail: `items [${items.join(" | ")}]; header menus ${inHeader}` };
  },
};
