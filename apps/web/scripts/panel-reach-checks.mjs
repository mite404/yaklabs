// Checks what the keyboard and assistive technology reach around the projects panel (ADR-139),
// on a desktop window: the closed panel out of reach, and the Tab order through the rail and the
// panel.
// oxlint-disable no-await-in-loop -- one keyboard drives one page, so each step waits for the last
import { openDesk } from "./sidebar-checks.mjs";

const THEMES = ["light", "dark"];
// How many Tabs a walk from the toggle takes before it gives up.
const TABS = 60;
// What the closed panel must hide: a thread's row and the resize edge, by their accessibility
// role and name.
const HIDDEN = [
  { role: "link", name: "Refund audit" },
  { role: "separator", name: "Resize the sidebar" },
];

// Runs in the page: whether keyboard focus is inside the panel.
const focusInPanel = () =>
  (document.activeElement?.closest('[data-slot="sidebar-container"]') ?? null) !== null;

// Tabs from the toggle up to TABS times; whether any stop was inside the panel.
async function tabsIntoPanel(page) {
  await page.getByRole("button", { name: "Toggle sidebar" }).focus();
  for (let step = 0; step < TABS; step++) {
    await page.keyboard.press("Tab");
    if ((await page.evaluate(focusInPanel)) === true) return true;
  }
  return false;
}

// Which of HIDDEN the accessibility tree offers, unignored, as the browser builds it for a
// screen reader.
async function exposed(page) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  await cdp.detach();
  const offered = (want) =>
    nodes.some(
      (node) =>
        node.ignored !== true && node.role?.value === want.role && node.name?.value === want.name,
    ) === true;
  return HIDDEN.filter((want) => offered(want)).map((want) => want.name);
}

// The panel's reach now: Tab, inert and the accessibility tree.
const reachOf = async (page) => ({
  tabbed: await tabsIntoPanel(page),
  inert: await page.locator('[data-slot="sidebar-container"]').evaluate((el) => el.inert),
  exposed: await exposed(page),
});

// P32 in one theme: closed at rest, then docked by Ctrl/Cmd+B.
async function outOfReach(browser, theme) {
  const { context, page } = await openDesk(browser, { theme });
  await page.mouse.move(900, 500);
  const away = await reachOf(page);
  await page.keyboard.press("ControlOrMeta+b");
  await page.waitForTimeout(200);
  const docked = await reachOf(page);
  await context.close();
  return {
    ok:
      !away.tabbed &&
      away.inert === true &&
      away.exposed.length === 0 &&
      docked.tabbed &&
      docked.inert === false &&
      docked.exposed.length === HIDDEN.length,
    note: `${theme} closed: Tab into it ${away.tabbed}, inert ${away.inert}, exposed [${away.exposed.join(", ")}]; docked: Tab into it ${docked.tabbed}, inert ${docked.inert}, exposed [${docked.exposed.join(", ")}]`,
  };
}

/** The workspace lever's checks of what reaches the panel, by id; panel-checks.mjs registers them. */
export const panelReachChecks = {
  // The closed panel is out of reach (ADR-139): inert, never a stop in 60 Tabs from the toggle,
  // and no row or resize edge in the accessibility tree (Playwright's role queries do not treat
  // inert as hidden, so the tree is read from the browser itself); docked, all three come back.
  async P32(browser) {
    const results = [];
    for (const theme of THEMES) results.push(await outOfReach(browser, theme));
    return { ok: results.every((r) => r.ok), detail: results.map((r) => r.note).join("; ") };
  },
};
