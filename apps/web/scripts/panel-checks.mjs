// Checks for the projects panel beside the rail, on a desktop window with motion on: where
// keyboard focus goes as the panel closes.
// oxlint-disable no-await-in-loop -- one keyboard drives one page, so each step waits for the last
import { openDesk } from "./sidebar-checks.mjs";

const THEMES = ["light", "dark"];
// What the closing panel hides that keyboard focus can sit on: a project row and the edge.
const HIDDEN_ON_CLOSE = [
  { role: "button", name: "Demo store" },
  { role: "separator", name: "Resize the sidebar" },
];

// Runs in the page: the focused element as its role and name, or "body".
function focusedNow() {
  const at = document.activeElement;
  if (at === null || at === document.body) return "body";
  const role = at.getAttribute("role") ?? at.tagName.toLowerCase();
  return `${role} ${at.getAttribute("aria-label") ?? at.textContent.trim()}`;
}

// Keyboard focus on a control by a Tab onto it, so it is focus-visible as a visitor's is.
async function tabOnto(page, target) {
  await target.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
}

// P27's one case: docked, keyboard focus on `place`, then Ctrl/Cmd+B.
async function closeFrom(browser, theme, place) {
  const { context, page } = await openDesk(browser, { side: "open", theme });
  const target = page.getByRole(place.role, { name: place.name, exact: true });
  const toggle = page.getByRole("button", { name: "Toggle sidebar" });
  await tabOnto(page, target);
  const held = await target.evaluate((el) => el === document.activeElement);
  await page.keyboard.press("ControlOrMeta+b");
  await page.waitForTimeout(100);
  const handed = await toggle.evaluate((el) => el === document.activeElement);
  const now = await page.evaluate(focusedNow);
  const expanded = await toggle.getAttribute("aria-expanded");
  await context.close();
  return {
    ok: held === true && handed === true && expanded === "false",
    note: `${theme} ${place.name}: focused ${held}, then ${now}, expanded ${expanded}`,
  };
}

/** The workspace lever's checks of the projects panel beside the rail, by id. */
export const panelChecks = {
  // Closing the docked panel by Ctrl/Cmd+B with keyboard focus on a project row or on the
  // resize edge hands focus to Toggle sidebar, never to the page's body.
  async P27(browser) {
    const results = [];
    for (const theme of THEMES) {
      for (const place of HIDDEN_ON_CLOSE) results.push(await closeFrom(browser, theme, place));
    }
    return { ok: results.every((r) => r.ok), detail: results.map((r) => r.note).join("; ") };
  },
};
