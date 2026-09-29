// Checks that the rail holds and the projects panel moves beside it (ADR-139), on a desktop
// window with motion on: at rest, docked at several widths, and at seeked frames of the peek
// and of an unpin.
// oxlint-disable no-await-in-loop -- one pointer drives one page, so each step waits for the last
import { differShare, openDesk } from "./sidebar-checks.mjs";

const THEMES = ["light", "dark"];
// The rail's box at 1440x900, the window 16px in behind its 1px border (window.tsx, rail.tsx).
const RAIL_AT = { x: 17, width: 56 };
// The panel's kept widths a check docks it at.
const WIDTHS = [208, 256, 400];
// The instants a slide is held at: its start, every 40ms, and a millisecond before it ends.
const FRAMES = [0, 40, 80, 120, 160, 219];
// The instant an unpin (200ms, sidebar.tsx) is held at.
const MID_UNPIN_MS = 100;
// How far a glyph may drift, in CSS px, and how many of the rail's pixels may differ from rest by
// more than 8 levels (antialiasing), as a share.
const DRIFT_PX = 0.5;
const PIXELS_OFF = 0.001;

// Runs in the page: the rail's box against the window's body, its places' glyphs, the avatar's
// centre and foot, how many accounts there are and whether the old echo is back.
function readRail() {
  const rail = document.querySelector('[data-slot="rail"]');
  const body = document.querySelector('[data-slot="window-body"]').getBoundingClientRect();
  const box = rail.getBoundingClientRect();
  const avatar = rail.querySelector('[aria-label="Account"]').getBoundingClientRect();
  return {
    box: [box.x, box.y, box.width, box.height],
    body: [body.y, body.height],
    glyphs: [...rail.querySelectorAll('[data-sidebar="menu-button"] svg')].map((svg) => {
      const r = svg.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    }),
    avatar: [avatar.x + avatar.width / 2, box.bottom - avatar.bottom],
    accounts: document.querySelectorAll('[aria-label="Account"]').length,
    echo: document.querySelector('[data-slot="rail-echo"]') !== null,
  };
}

// A reading's glyph boxes and avatar as one list of numbers.
const spotsOf = (look) => [...look.glyphs.flat(), ...look.avatar];

// The largest distance between two readings' glyphs and avatars, in CSS px.
function drift(rest, now) {
  const [a, b] = [spotsOf(rest), spotsOf(now)];
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  return Math.max(...a.map((value, i) => Math.abs(value - b[i])));
}

// The rail's look now: its reading and its pixels.
async function railNow(page) {
  const look = await page.evaluate(readRail);
  const [x, y, width, height] = look.box;
  const png = await page.screenshot({ clip: { x, y, width, height } });
  return { look, png: png.toString("base64") };
}

// Waits for the panel's transitions in `phase` to start, then pauses them, held for seeking.
const catchSlide = (page, phase) =>
  page.evaluate(
    (want) =>
      new Promise((done) => {
        const sidebar = document.querySelector('[data-slot="sidebar"]');
        const panel = document.querySelector('[data-slot="sidebar-container"]');
        const tick = () => {
          const running = panel.getAnimations();
          if ((sidebar.dataset.peek ?? "away") !== want || running.length === 0) {
            requestAnimationFrame(tick);
            return;
          }
          for (const a of running) a.pause();
          window.heldSlide = running;
          done(running.length);
        };
        tick();
      }),
    phase,
  );

// Seeks the held transitions to `ms`, and lets them finish.
const seekHeld = (page, ms) =>
  page.evaluate((at) => {
    for (const a of window.heldSlide) a.currentTime = at;
  }, ms);
const finishHeld = (page) =>
  page.evaluate(() => {
    for (const a of window.heldSlide) a.finish();
  });

// The rail at each held frame of a peek sliding out, then back.
async function railThroughPeek(page) {
  const seen = [];
  await page.mouse.move(900, 500);
  const out = catchSlide(page, "open");
  await page.mouse.move(28, 650, { steps: 3 });
  await out;
  for (const ms of FRAMES) {
    await seekHeld(page, ms);
    seen.push({ label: `out ${ms}ms`, ...(await railNow(page)) });
  }
  await finishHeld(page);
  await page.waitForTimeout(300);
  const back = catchSlide(page, "leaving");
  await page.mouse.move(900, 500);
  await back;
  for (const ms of FRAMES) {
    await seekHeld(page, ms);
    seen.push({ label: `back ${ms}ms`, ...(await railNow(page)) });
  }
  await finishHeld(page);
  return seen;
}

// The rail halfway through a pointer's unpin of the docked panel, the unpin's transitions held.
async function railMidUnpin(page) {
  const held = page.evaluate(
    (ms) =>
      new Promise((done) => {
        const moving = new Set(["width", "left", "min-width"]);
        const tick = () => {
          const running = document.getAnimations().filter((a) => moving.has(a.transitionProperty));
          if (running.length === 0) {
            requestAnimationFrame(tick);
            return;
          }
          for (const a of running) {
            a.pause();
            a.currentTime = ms;
          }
          done(running.length);
        };
        tick();
      }),
    MID_UNPIN_MS,
  );
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await held;
  return { label: `mid-unpin ${MID_UNPIN_MS}ms`, ...(await railNow(page)) };
}

// P29 in one theme: the rail at rest, docked at each width, through a peek and mid-unpin.
async function railHolds(browser, theme) {
  const closed = await openDesk(browser, { theme });
  await closed.page.mouse.move(900, 500);
  const rest = await railNow(closed.page);
  const views = await railThroughPeek(closed.page);
  await closed.context.close();
  for (const width of WIDTHS) {
    const open = await openDesk(browser, { side: "open", width, theme });
    await open.page.mouse.move(900, 500);
    views.push({ label: `docked ${width}px`, ...(await railNow(open.page)) });
    if (width === 256) views.push(await railMidUnpin(open.page));
    await open.context.close();
  }
  const probe = await openDesk(browser, { theme });
  const scored = [];
  for (const view of views) {
    const off = await probe.page.evaluate(differShare, [rest.png, view.png]);
    scored.push({ label: view.label, drift: drift(rest.look, view.look), off });
  }
  await probe.context.close();
  const [x, y, width, height] = rest.look.box;
  const placed =
    x === RAIL_AT.x &&
    width === RAIL_AT.width &&
    y === rest.look.body[0] &&
    height === rest.look.body[1] &&
    rest.look.avatar[0] === RAIL_AT.x + RAIL_AT.width / 2 &&
    rest.look.avatar[1] <= 16;
  const single = rest.look.accounts === 1 && rest.look.echo === false;
  const still = scored.every((view) => view.drift <= DRIFT_PX && view.off <= PIXELS_OFF);
  const worst = Math.max(...scored.map((view) => view.off));
  return {
    ok: placed && single && still,
    note: `${theme}: rail ${JSON.stringify(rest.look.box)} over a body at ${JSON.stringify(rest.look.body)}, avatar centre ${rest.look.avatar[0]}, ${rest.look.avatar[1]}px off the foot; accounts ${rest.look.accounts}, echo ${rest.look.echo}; ${scored.length} views, most drift ${Math.max(...scored.map((view) => view.drift))}px, most pixels off ${Math.round(worst * 100_000) / 1000}%${
      still
        ? ""
        : ` (${scored
            .filter((view) => view.drift > DRIFT_PX || view.off > PIXELS_OFF)
            .map((view) => `${view.label} ${view.drift}px ${view.off}`)
            .join(", ")})`
    }`,
  };
}

/** The workspace lever's checks of the rail and the panel's frames, by id; panel-checks.mjs registers them. */
export const panelFrameChecks = {
  // The rail holds (ADR-139): 56px at the window's inner left, the body's full height, its
  // glyphs and avatar on the same pixels, and its pixels as at rest (antialiasing aside), with
  // the panel closed, docked at 208, 256 and 400px, at every held frame of a peek out and back,
  // and halfway through an unpin; one account, and no echo of the rail beneath the panel.
  async P29(browser) {
    const results = [];
    for (const theme of THEMES) results.push(await railHolds(browser, theme));
    return { ok: results.every((r) => r.ok), detail: results.map((r) => r.note).join("; ") };
  },
};
