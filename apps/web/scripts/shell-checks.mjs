// Checks for sub-threads, the project rows, persistence, the mock scenarios, the tabs, the
// simulated browser, the title bar and the rail.
import { writeFileSync } from "node:fs";
import { canvasOf, carry, laneTitles, mainPanel, makeLane } from "./canvas-checks.mjs";
import { BASE, openApp, shotPath } from "./lever.mjs";

// The polygon meetkay.ai declares for its mark (ADR-095), as the rail must draw it.
const KAY_POINTS =
  "52.4 39.26 78.59 78.54 26.16 78.54 52.34 39.32 26.25 39.26 .03 78.45 0 .02 26.19 .02 26.25 39.08 52.39 0 78.55 .06 52.4 39.26";
const SCENARIOS = ["demo", "long", "empty", "loading", "failure", "thread-fails"];

const sidebarOf = (page) => page.locator('[data-slot="sidebar"]');
const titleBar = (page) => page.locator('header[data-slot="title-bar"]');
const tabsOf = (page) => page.getByRole("tablist", { name: "Open threads" }).getByRole("tab");
const layoutButton = (page, name) =>
  page.getByRole("group", { name: "Layout" }).getByRole("button", { name, exact: true });
const pathOf = (page) => new URL(page.url()).pathname;

// Two edges that meet, give or take a pixel of rounding.
const near = (a, b) => Math.abs(a - b) <= 1;

// The box of a locator, or null when it is not on screen.
const boxOf = (locator) => locator.boundingBox().catch(() => null);

// The widths below the window's frame (ADR-111) where the bar must still fit (ADR-116).
const NARROW = [390, 520, 767];
// About ten characters of the active tab's title at 12px.
const LEGIBLE_PX = 64;

// Runs in the page: the bar's controls left to right, whether any two overlap or leave the bar,
// and how much of the active tab and its title the tabs' scroller shows.
function barLayout() {
  const bar = document.querySelector('header[data-slot="title-bar"]');
  const edge = bar.getBoundingClientRect();
  const drawn = (selector) =>
    [...bar.querySelectorAll(selector)].find((el) => el.getClientRects().length > 0);
  const controls = [
    ["toggle", drawn('[aria-label="Toggle sidebar"]')],
    ["tabs", drawn(".tab-scroller")],
    ["new", drawn('[aria-label="New thread"]')],
    ["marker", drawn('[data-slot="data-marker"]')?.closest("button")],
    ["layout", drawn('button[aria-label="Layout"], [role="group"][aria-label="Layout"]')],
    ["bell", drawn('[aria-label^="Notifications"]')],
    ["account", drawn('[aria-label="Account"]')],
  ]
    .filter(([, el]) => el !== undefined && el !== null)
    .map(([name, el]) => [name, el.getBoundingClientRect()]);
  const overlaps = controls
    .slice(1)
    .filter(([, box], i) => box.x < controls[i][1].right - 0.5)
    .map(([name], i) => `${controls[i][0]}>${name}`);
  const outside = controls
    .filter(([, box]) => box.x < edge.x - 0.5 || box.right > edge.right + 0.5)
    .map(([name]) => name);
  const list = bar.querySelector(".tab-scroller").getBoundingClientRect();
  const tab = bar.querySelector('[role="tab"][aria-selected="true"]').getBoundingClientRect();
  const title = bar.querySelector('[role="tab"][aria-selected="true"] .truncate');
  const shown = title.getBoundingClientRect();
  return {
    height: Math.round(edge.height),
    scroll: [bar.scrollWidth, bar.clientWidth],
    page: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    names: controls.map(([name]) => name),
    overlaps,
    outside,
    tabWhole: tab.x >= list.x - 0.5 && tab.right <= list.right + 0.5,
    titlePx: Math.round(Math.min(shown.right, list.right) - Math.max(shown.x, list.x)),
    titleFull: title.scrollWidth,
  };
}

// One width in one theme: the bar's layout, its picture, and on a phone the Layout menu at work.
async function narrowBar(browser, { theme, width }) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    reducedMotion: "reduce",
  });
  await context.addInitScript((chosen) => {
    localStorage.setItem("theme", chosen);
  }, theme);
  const page = await context.newPage();
  await page.goto(`${BASE}/?scenario=demo`, { waitUntil: "load" });
  await page.getByRole("tab", { selected: true }).waitFor({ timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(width / 2, 400);
  const m = await page.evaluate(barLayout);
  const fits =
    m.height === 44 &&
    m.scroll[0] === m.scroll[1] &&
    m.page[0] === m.page[1] &&
    m.names.length === 7 &&
    m.overlaps.length === 0 &&
    m.outside.length === 0 &&
    m.tabWhole === true &&
    m.titlePx >= Math.min(m.titleFull, LEGIBLE_PX);
  await titleBar(page).screenshot({ path: shotPath(`P13-bar-${width}-${theme}`) });
  const trigger = titleBar(page).getByRole("button", { name: "Layout", exact: true });
  let switched = width >= 768 || (await trigger.isVisible()) === true;
  if (width < 768 && switched) {
    await trigger.click();
    await layoutButton(page, "Canvas").click();
    await page
      .locator('[role="tabpanel"]:not([inert]) [aria-label="Compose canvas"]')
      .waitFor({ timeout: 10_000 });
    switched = (await page.getByRole("group", { name: "Layout" }).count()) === 0;
  }
  await context.close();
  return {
    ok: fits && switched,
    note: `${theme} ${width}: 44px ${m.height === 44}; bar ${m.scroll.join("/")}; page ${m.page.join("/")}; ${m.names.length} controls; overlaps [${m.overlaps}]; outside [${m.outside}]; tab whole ${m.tabWhole}; title ${m.titlePx}/${m.titleFull}px; layout menu ${switched}`,
  };
}

async function onThreadPage(browser) {
  const opened = await openApp(browser);
  await opened.page.waitForURL(/\/t\//, { timeout: 20_000 });
  return opened;
}

function selectedTab(page) {
  return page
    .getByRole("tablist", { name: "Open threads" })
    .getByRole("tab", { selected: true })
    .innerText()
    .catch(() => "");
}

async function scenarioLook(browser, name) {
  const { page } = await openApp(browser, `${BASE}/?scenario=${name}`, { ready: null });
  const marker = page.locator('[data-slot="data-marker"]');
  await marker.waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  const png = await page.screenshot();
  const look = {
    marker: await marker.innerText(),
    projects: await sidebarOf(page).locator("[aria-expanded]").count(),
    tabs: await tabsOf(page).count(),
    skeletons: await page.locator('[data-sidebar="menu-skeleton"]').count(),
    tryAgain: await page.getByRole("button", { name: "Try again" }).count(),
    noProjects: await page.getByText("No projects yet").count(),
    url: page.url(),
  };
  await page.close();
  return { png, look };
}

// What each scenario must show besides being mock and deterministic.
const EXPECT = {
  demo: (l) => l.projects >= 2 && l.tabs === 2,
  long: (l) => l.projects >= 12 && l.tabs >= 12,
  empty: (l) => l.noProjects === 1 && l.tabs === 0,
  loading: (l) => l.skeletons >= 3 && l.tabs <= 1,
  failure: (l) => l.tryAgain >= 1,
  "thread-fails": (l) => l.projects >= 1 && l.tryAgain >= 1,
};

export const shellChecks = {
  async P4(browser) {
    const { page } = await onThreadPage(browser);
    const home = pathOf(page);
    const side = sidebarOf(page);
    await side.getByRole("button", { name: "Demo store", exact: true }).waitFor();
    await canvasOf(page).getByRole("button", { name: "Create blank thread" }).click();
    const child = side.locator('[data-thread="child"]').first();
    await child.waitFor({ timeout: 10_000 });
    const childText = await child.innerText();
    await child.click();
    await page.waitForURL((url) => url.pathname !== home, { timeout: 10_000 });
    const childPath = pathOf(page);
    const mainTitle = await mainPanel(page).locator(".thread-header").innerText();
    const lane = canvasOf(page).locator(':scope > article[aria-label="New thread"]');
    const laneShown = await lane.isVisible();
    await side.getByRole("link", { name: "Last week's sales" }).click();
    await page.waitForURL((url) => url.pathname === home, { timeout: 10_000 });
    const laneStill = await lane.isVisible();
    await side.getByRole("button", { name: "New thread in Demo store" }).click();
    await page.waitForURL((url) => ![home, childPath].includes(url.pathname), { timeout: 10_000 });
    const mains = await side.locator('[data-thread="main"]').count();
    await page.screenshot({ path: shotPath("P4-sidebar") });
    return {
      ok:
        childText.includes("↳") &&
        childText.includes("New thread") &&
        mainTitle === "Last week's sales" &&
        laneShown &&
        laneStill &&
        mains >= 2,
      detail: `child row ${JSON.stringify(childText)} opens ${childPath} with main "${mainTitle}" and its lane ${laneShown}; main row keeps the lane ${laneStill}; mains in the project ${mains}`,
    };
  },

  async P5(browser) {
    const { page } = await onThreadPage(browser);
    const project = sidebarOf(page).getByRole("button", { name: "Demo store", exact: true });
    const chevron = project.locator('[data-slot="project-chevron"]');
    const look = async () => ({
      expanded: await project.getAttribute("aria-expanded"),
      chevron: await chevron.evaluate((el) => getComputedStyle(el).opacity),
    });
    await page.mouse.move(900, 450);
    await page.waitForTimeout(250);
    const openRest = await look();
    await project.hover();
    await page.waitForTimeout(250);
    const openHover = await look();
    await project.screenshot({ path: shotPath("P5-open-hover") });
    await project.click();
    await page.mouse.move(900, 450);
    await page.waitForTimeout(250);
    const folded = await look();
    await project.screenshot({ path: shotPath("P5-folded") });
    const threadsHidden = !(await sidebarOf(page)
      .getByRole("link", { name: "Last week's sales" })
      .isVisible());
    const plus = await sidebarOf(page)
      .getByRole("button", { name: "New thread in Demo store" })
      .isVisible();
    return {
      ok:
        openRest.expanded === "true" &&
        openRest.chevron === "0" &&
        openHover.chevron === "1" &&
        folded.expanded === "false" &&
        folded.chevron === "1" &&
        threadsHidden &&
        plus,
      detail: `open at rest ${JSON.stringify(openRest)}, on hover ${JSON.stringify(openHover)}, folded ${JSON.stringify(folded)}; threads hidden when folded ${threadsHidden}; + shown ${plus}`,
    };
  },

  async P6(browser) {
    const { page } = await onThreadPage(browser);
    await makeLane(page, "Weekend margins");
    await makeLane(page, "Sunday");
    // Naming the second lane scrolls the row to it; the carry aims at the first lane's gap, as P3 does.
    await canvasOf(page).evaluate((el) => (el.scrollLeft = 0));
    const heading = mainPanel(page).locator(".card-heading").first();
    await heading.scrollIntoViewIfNeeded();
    const hb = await heading.boundingBox();
    const first = await canvasOf(page).locator(":scope > article").first().boundingBox();
    await carry(page, { x: hb.x + 30, y: hb.y + hb.height / 2 }, [
      { x: first.x - 6, y: first.y + first.height / 2 },
    ]);
    await page.mouse.up();
    await page.waitForTimeout(600);
    await canvasOf(page).getByRole("button", { name: "Close Sunday" }).click();
    const gap = canvasOf(page).getByRole("separator", { name: "Resize or move Weekend margins" });
    await gap.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(400);
    const width = async () =>
      Math.round(
        (
          await canvasOf(page)
            .locator(':scope > article[aria-label="Weekend margins"]')
            .boundingBox()
        ).width,
      );
    const before = { titles: await laneTitles(page), width: await width() };
    await page.reload({ waitUntil: "load" });
    await canvasOf(page).locator(":scope > article").first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(500);
    const after = { titles: await laneTitles(page), width: await width() };
    const children = await sidebarOf(page).locator('[data-thread="child"]').allInnerTexts();
    return {
      ok:
        JSON.stringify(before.titles) === JSON.stringify(after.titles) &&
        after.titles[0] === "Last week's profit by day" &&
        !after.titles.includes("Sunday") &&
        before.width === after.width &&
        children.some((t) => t.includes("Sunday")) &&
        children.some((t) => t.includes("Weekend margins")),
      detail: `lanes ${before.titles.join(" | ")} → ${after.titles.join(" | ")}; width ${before.width} → ${after.width}; sidebar children ${children.join(" / ")}`,
    };
  },

  async P7(browser) {
    const results = [];
    for (const name of SCENARIOS) {
      const a = await scenarioLook(browser, name);
      const b = await scenarioLook(browser, name);
      writeFileSync(shotPath(`P7-${name}`), a.png);
      results.push({
        name,
        same: Buffer.compare(a.png, b.png) === 0,
        mock: a.look.marker.toLowerCase().includes("mock"),
        shows: EXPECT[name](a.look),
        kept: a.look.url.includes(`scenario=${name}`),
        look: a.look,
      });
    }
    return {
      ok: results.every((r) => r.same && r.mock && r.shows && r.kept),
      detail: results
        .map((r) => `${r.name}: same ${r.same}, mock ${r.mock}, shows ${r.shows}, kept ${r.kept}`)
        .join("; "),
    };
  },

  async P9(browser) {
    const { page } = await onThreadPage(browser);
    const compose = mainPanel(page).getByRole("textbox", { name: "Message" });
    await compose.fill("draft kept");
    await sidebarOf(page).getByRole("button", { name: "New thread in Demo store" }).click();
    await page.waitForFunction(() => location.pathname !== "/t/profit");
    await layoutButton(page, "Browser").click();
    const browserShown = await page.getByRole("region", { name: "Browser" }).isVisible();
    await tabsOf(page).filter({ hasText: "Last week's sales" }).click();
    const canvasBack = await canvasOf(page).isVisible();
    const draft = await mainPanel(page).getByRole("textbox", { name: "Message" }).inputValue();
    await tabsOf(page).filter({ hasText: "New thread" }).click();
    const browserBack = await page.getByRole("region", { name: "Browser" }).isVisible();
    await page.reload({ waitUntil: "load" });
    await tabsOf(page).first().waitFor({ timeout: 20_000 });
    const afterReload = {
      tabs: await tabsOf(page).count(),
      active: await selectedTab(page),
      browser: await page.getByRole("region", { name: "Browser" }).isVisible(),
    };
    await tabsOf(page).filter({ hasText: "Last week's sales" }).click();
    const canvasAfter = await canvasOf(page).isVisible();
    await layoutButton(page, "Thread").click();
    await page.waitForTimeout(300);
    const alone = await page.locator('[role="tabpanel"]:not([inert])').evaluate((tab) => {
      const thread = tab.querySelector('[data-slot="resizable-panel"]');
      const share = thread.getBoundingClientRect().width / tab.getBoundingClientRect().width;
      return Math.round(share * 100);
    });
    await titleBar(page).screenshot({ path: shotPath("P9-title-bar") });
    return {
      ok:
        alone === 100 &&
        browserShown &&
        canvasBack &&
        draft === "draft kept" &&
        browserBack &&
        afterReload.tabs === 2 &&
        afterReload.active.includes("New thread") &&
        afterReload.browser &&
        canvasAfter,
      detail: `browser ${browserShown}; back to canvas ${canvasBack} with draft ${JSON.stringify(draft)}; browser again ${browserBack}; after reload ${JSON.stringify(afterReload)}, canvas ${canvasAfter}; the thread alone fills ${alone}% of its tab`,
    };
  },

  async P10(browser) {
    const { page } = await onThreadPage(browser);
    await layoutButton(page, "Browser").click();
    const pane = page.getByRole("region", { name: "Browser" });
    const address = pane.getByRole("textbox", { name: "Address" });
    const start = await address.inputValue();
    await address.fill("weather.example/radar");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const went = await address.inputValue();
    await pane.getByRole("button", { name: "Back" }).click();
    const back = await address.inputValue();
    await pane.getByRole("button", { name: "Forward" }).click();
    const forward = await address.inputValue();
    await pane.getByRole("button", { name: "Reload" }).click();
    await pane.screenshot({ path: shotPath("P10-browser") });
    await page.reload({ waitUntil: "load" });
    await page.getByRole("region", { name: "Browser" }).waitFor({ timeout: 20_000 });
    const kept = await page
      .getByRole("region", { name: "Browser" })
      .getByRole("textbox", { name: "Address" })
      .inputValue();
    return {
      ok:
        start !== "" &&
        went.includes("weather.example/radar") &&
        back === start &&
        forward === went &&
        kept === went,
      detail: `start ${start}; went ${went}; back ${back}; forward ${forward}; after reload ${kept}`,
    };
  },

  async P11(browser) {
    const { page } = await onThreadPage(browser);
    const win = await boxOf(page.locator('[data-slot="window"]'));
    const radius = await page
      .locator('[data-slot="window"]')
      .evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
    const bar = titleBar(page);
    const barBox = await boxOf(bar);
    const lights = bar.locator('[data-slot="traffic-lights"]');
    const lightsBox = await boxOf(lights);
    const lightsHidden = await lights.getAttribute("aria-hidden");
    const toggle = await boxOf(bar.getByRole("button", { name: "Toggle sidebar" }));
    const strip = await boxOf(bar.getByRole("tablist", { name: "Open threads" }));
    const bell = await boxOf(bar.getByRole("button", { name: "Notifications" }));
    const account = await boxOf(bar.getByRole("button", { name: "Account" }));
    const rightmost = await bar
      .getByRole("button")
      .evaluateAll((els) => Math.max(...els.map((el) => el.getBoundingClientRect().right)));
    const side = await boxOf(page.locator('[data-slot="sidebar-container"]'));
    await page.screenshot({ path: shotPath("P11-window") });
    await page.setViewportSize({ width: 700, height: 900 });
    await page.waitForTimeout(300);
    const narrow = await boxOf(page.locator('[data-slot="window"]'));
    const ok =
      win !== null &&
      win.x >= 6 &&
      win.y >= 6 &&
      radius >= 10 &&
      near(barBox.x, win.x) &&
      near(barBox.x + barBox.width, win.x + win.width) &&
      near(barBox.y, win.y) &&
      lightsHidden === "true" &&
      lightsBox.x + lightsBox.width <= toggle.x &&
      toggle.x + toggle.width <= strip.x &&
      bell.x + bell.width <= account.x &&
      near(account.x + account.width, rightmost) &&
      side.y >= barBox.y + barBox.height - 1 &&
      narrow.x === 0;
    return {
      ok,
      detail: `window ${JSON.stringify(win)} radius ${radius}; bar ${JSON.stringify(barBox)}; lights before toggle ${lightsBox.x + lightsBox.width <= toggle.x}; toggle before tabs ${toggle.x + toggle.width <= strip.x}; bell before account ${bell.x + bell.width <= account.x}; account rightmost ${near(account.x + account.width, rightmost)}; sidebar under bar ${side.y >= barBox.y + barBox.height - 1}; full-bleed at 700px ${narrow.x === 0}`,
    };
  },

  async P12(browser) {
    const { page } = await onThreadPage(browser);
    const kay = page.getByRole("link", { name: "Kay", exact: true });
    const points = await kay.locator("svg polygon").getAttribute("points");
    const docs = page.getByRole("link", { name: "Documentation" });
    const kb = await kay.boundingBox();
    const db = await docs.boundingBox();
    const order = await page
      .locator('[data-slot="sidebar"] a')
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute("aria-label") ?? el.textContent.trim()),
      );
    const docsNext = order.indexOf("Documentation") === order.indexOf("Kay") + 1;
    await page.locator('[data-slot="sidebar-header"]').screenshot({ path: shotPath("P12-rail") });
    return {
      ok:
        points?.replaceAll(/\s+/g, " ").trim() === KAY_POINTS &&
        db.y >= kb.y + kb.height - 1 &&
        docsNext,
      detail: `mark polygon ${points === null ? "missing" : "present"}${points?.replaceAll(/\s+/g, " ").trim() === KAY_POINTS ? " and exact" : ""}; docs below the mark ${db.y >= kb.y + kb.height - 1}; next link after the mark ${docsNext}`,
    };
  },

  async P13(browser) {
    const cases = ["light", "dark"].flatMap((theme) => NARROW.map((width) => ({ theme, width })));
    const results = await Promise.all(cases.map((each) => narrowBar(browser, each)));
    return {
      ok: results.every((each) => each.ok),
      detail: results.map((each) => each.note).join("; "),
    };
  },
};
