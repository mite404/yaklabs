// Checks that the projects panel extends from the rail's edge (ADR-139), on a desktop window
// with motion on: docked at several widths, closed, peeking and at held frames of the peek, and
// on a window too short for every place.
// oxlint-disable no-await-in-loop -- one pointer drives one page, so each step waits for the last
import { BASE } from "./lever.mjs";
import { throughPeek, WIDTHS } from "./panel-frame-checks.mjs";
import { openDesk } from "./sidebar-checks.mjs";

const THEMES = ["light", "dark"];
// The tabs start this far past the docked panel's edge, and right after the toggle with it
// closed (title-bar.tsx); the panel's default width (sidebar-width.ts).
const TAB_INSET = 4;
const TAB_CLOSED = 137;
const DEFAULT_PX = 256;
// A window too short for every place (ADR-139's default: they scroll, the account stays put).
const SHORT = { width: 1024, height: 480 };
// How many heights the rail's edge is probed at, and how close the account keeps to its foot.
const PROBES = 10;
const FOOT_PX = 16;

// Runs in the page: where the panel sits against the rail and what sits beside it: the rail's
// right, the panel's left and width, main's left, the first tab's left, whether the panel is
// inert, the stage's overflow, and how many of `probes` heights down the rail's edge the rail
// itself draws.
function readPanel(probes) {
  const rail = document.querySelector('[data-slot="rail"]').getBoundingClientRect();
  const panel = document.querySelector('[data-slot="sidebar-container"]');
  const box = panel.getBoundingClientRect();
  const hits = Array.from({ length: probes }, (_, i) => {
    const hit = document.elementFromPoint(
      rail.right - 1,
      rail.top + ((i + 0.5) * rail.height) / probes,
    );
    return hit !== null && hit.closest('[data-slot="rail"]') !== null;
  });
  return {
    railRight: rail.right,
    left: box.left,
    width: box.width,
    main: document.querySelector('[role="main"]').getBoundingClientRect().x,
    tab: document.querySelector('[role="tab"]').getBoundingClientRect().x,
    inert: panel.inert,
    clip: getComputedStyle(document.querySelector('[data-slot="stage"]')).overflowX,
    railHits: hits.filter(Boolean).length,
  };
}

const panelNow = (page) => page.evaluate(readPanel, PROBES);

// Whether a docked panel extends from the rail's edge at its kept width, with the workspace and
// the first tab past it.
const dockedRight = (at, width) =>
  at.left === at.railRight &&
  at.width === width &&
  at.main === at.left + at.width &&
  at.tab === at.main + TAB_INSET &&
  at.inert === false;

// Whether a closed panel leaves the workspace at the rail and the tabs after the toggle, out of
// reach.
const closedAway = (at) => at.main === at.railRight && at.tab === TAB_CLOSED && at.inert === true;

// Whether a peeking panel starts at the rail's edge at its width while nothing beneath moves.
const peeksBeside = (at, closed) =>
  at.left === at.railRight &&
  at.width === DEFAULT_PX &&
  at.main === closed.main &&
  at.tab === closed.tab;

// P30's short window: the account keeps the rail's foot and the Lab, last of the places, is
// brought into view by focus, the places scrolling with no scrollbar drawn.
async function shortWindow(browser, theme) {
  const context = await browser.newContext({ viewport: SHORT, deviceScaleFactor: 2 });
  await context.addInitScript((t) => {
    localStorage.setItem("theme", t);
    localStorage.setItem("kay.sidebar", "closed");
  }, theme);
  const page = await context.newPage();
  await page.goto(`${BASE}/?scenario=demo`);
  await page.locator('[data-slot="rail"]').waitFor();
  await page.locator('[data-slot="rail"] a[aria-label="Lab"]').focus();
  const look = await page.evaluate(() => {
    const rail = document.querySelector('[data-slot="rail"]').getBoundingClientRect();
    const places = document.querySelector('[data-slot="rail"] [role="navigation"]');
    const box = places.getBoundingClientRect();
    const lab = places.querySelector('a[aria-label="Lab"]').getBoundingClientRect();
    const account = document.querySelector('[data-slot="rail"] [aria-label="Account"]');
    return {
      scrolls: places.scrollHeight > places.clientHeight,
      labShown: lab.top >= box.top && lab.bottom <= box.bottom,
      noBar: places.offsetWidth === places.clientWidth,
      foot: rail.bottom - account.getBoundingClientRect().bottom,
    };
  });
  await context.close();
  return {
    ok:
      look.scrolls === true &&
      look.labShown === true &&
      look.noBar === true &&
      look.foot <= FOOT_PX,
    note: `${theme} ${SHORT.width}x${SHORT.height}: places scroll ${look.scrolls}, Lab in view on focus ${look.labShown}, no scrollbar ${look.noBar}, account ${look.foot}px off the foot`,
  };
}

// P30 in one theme: docked at each width, closed, peeking and through the peek's frames.
async function panelBeside(browser, theme) {
  const notes = [];
  let ok = true;
  for (const width of WIDTHS) {
    const { context, page } = await openDesk(browser, { side: "open", width, theme });
    const at = await panelNow(page);
    await context.close();
    ok &&= dockedRight(at, width);
    notes.push(
      `${theme} docked ${width}: rail ${at.railRight}, panel ${at.left}+${at.width}, main ${at.main}, tab ${at.tab}`,
    );
  }
  const { context, page } = await openDesk(browser, { theme });
  const closed = await panelNow(page);
  const { frames, open } = await throughPeek(page, panelNow);
  await context.close();
  const gated = frames.filter((frame) => frame.railHits === PROBES && frame.clip === "clip");
  ok &&= closedAway(closed) && peeksBeside(open, closed) && gated.length === frames.length;
  notes.push(
    `${theme} closed: main ${closed.main}, tab ${closed.tab}, inert ${closed.inert}; peeking: panel ${open.left}+${open.width}, main ${open.main}, tab ${open.tab}; held frames with the rail's edge drawn by the rail at all ${PROBES} heights and the stage clipped: ${gated.length} of ${frames.length}`,
  );
  const short = await shortWindow(browser, theme);
  return { ok: ok && short.ok, note: [...notes, short.note].join("; ") };
}

/** The workspace lever's checks of the panel's edge, by id; panel-checks.mjs registers them. */
export const panelEdgeChecks = {
  // The panel extends from the rail's edge (ADR-139): docked at 208, 256 and 400px it starts at
  // the rail's right, the workspace at its right and the first tab 4px past; closed, the
  // workspace starts at the rail and the panel is inert; peeking, it starts at the rail again
  // while nothing beneath moves; at every held frame of the peek the rail's edge is the rail's
  // own, behind the stage's clip. On a short window the places scroll and the account holds.
  async P30(browser) {
    const results = [];
    for (const theme of THEMES) results.push(await panelBeside(browser, theme));
    return { ok: results.every((r) => r.ok), detail: results.map((r) => r.note).join("; ") };
  },
};
