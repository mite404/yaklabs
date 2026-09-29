// Checks how the projects panel's edge moves through the toggle (ADR-139), on a desktop window
// with motion on: through a pin from a peek, in both themes.
// oxlint-disable no-await-in-loop -- one pointer drives one page, so each step waits for the last
import { openDesk, peek, PIN_MS } from "./sidebar-checks.mjs";

const THEMES = ["light", "dark"];
// The instants a pin or an unpin is held at, in ms from its first frame.
const HELD_MS = [0, 20, 40, 60, 80, 120, 160, 200, PIN_MS - 1];

// Runs in the page: catches the toggle's slide as its `width` or `left` transition starts,
// holds every running transition at each of `at` and reads the panel's right past the rail's
// edge, its width, the rows' drawn opacity (their own and every box's up to the panel) and the
// panel's shadow, then lets them finish.
const heldToggle = (page, at) =>
  page.evaluate(
    (instants) =>
      new Promise((done) => {
        const panel = document.querySelector('[data-slot="sidebar-container"]');
        const rows = panel.querySelector('[data-slot="sidebar-content"]');
        const rail = document.querySelector('[data-slot="rail"]').getBoundingClientRect().right;
        const moving = new Set(["width", "left"]);
        const rowsSeen = () => {
          let seen = 1;
          for (let box = rows; box !== panel; box = box.parentElement) {
            seen *= Number(getComputedStyle(box).opacity);
          }
          return seen;
        };
        const tick = () => {
          const running = document.getAnimations().filter((a) => a.timeline === document.timeline);
          if (!running.some((a) => moving.has(a.transitionProperty))) {
            requestAnimationFrame(tick);
            return;
          }
          const frames = instants.map((ms) => {
            for (const a of running) a.currentTime = ms;
            const box = panel.getBoundingClientRect();
            const shadow = getComputedStyle(panel).boxShadow;
            return { ms, edge: box.right - rail, width: box.width, rows: rowsSeen(), shadow };
          });
          for (const a of running) a.finish();
          done(frames);
        };
        tick();
      }),
    at,
  );

// P37 in one theme: a pin by the toggle while the panel peeks, its shadow held through the slide.
async function edgeThroughPinFromPeek(browser, theme) {
  const { context, page } = await openDesk(browser, { theme });
  await peek(page);
  const pinning = heldToggle(page, HELD_MS);
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  const pin = await pinning;
  await page.waitForTimeout(PIN_MS + 150);
  const rest = await page
    .locator('[data-slot="sidebar-container"]')
    .evaluate((el) => getComputedStyle(el).boxShadow);
  await context.close();
  const held = pin.every((f) => f.shadow !== "none");
  return {
    ok: held === true && rest === "none",
    note: `${theme}: edge held on ${pin.filter((f) => f.shadow !== "none").length} of ${pin.length} frames, then ${rest}`,
  };
}

/** The workspace lever's checks of the panel's edge through the toggle, by id. */
export const panelMotionChecks = {
  // A pin while the panel peeks moves only the workspace, under the panel: the peek's edge (its
  // hairline and shadow) holds on every frame of the slide until the workspace's rounded border
  // is under it, then goes (Ethan).
  async P37(browser) {
    const results = [];
    for (const theme of THEMES) results.push(await edgeThroughPinFromPeek(browser, theme));
    return { ok: results.every((r) => r.ok), detail: results.map((r) => r.note).join("; ") };
  },
};
