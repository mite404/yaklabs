// Checks for the rail's places and their name pills, on a desktop window with motion on.
// oxlint-disable no-await-in-loop -- one pointer drives one page, so each step waits for the last
import { shotPath } from "./lever.mjs";
import { placeOf, RAIL_PLACES, readPlaces, readSoonRows } from "./rail-places.mjs";
import {
  CLOSE_MS,
  contrast,
  OPEN_MS,
  openDesk,
  peek,
  phaseOf,
  round,
  SLIDE_MS,
} from "./sidebar-checks.mjs";

// What a place not built yet says in its pill, and beside its name in the open sidebar.
const SOON = "Coming soon";
const SOON_SHORT = "Soon";
const SOON_PLACES = RAIL_PLACES.filter((place) => place.soon);
// The tab order from Kay: every place before the Lab.
const WALK = RAIL_PLACES.slice(1, -1).map((place) => place.name);
// The open sidebar's narrowest width, and a rail button's gap and side padding (rail-places.tsx).
const NARROWEST = 208;
const PLACE_GAP = 12;
const PLACE_PAD = 10;

// The pill a rail place shows once the pointer has rested on it, measured against the shell:
// its words, and for a place not built yet, how its softer "Coming soon" reads on the ink.
// Null when the rail has no such place.
async function pillOn(page, place) {
  const target = placeOf(page, place);
  if ((await target.count()) === 0) return null;
  const box = await target.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 });
  const pill = page
    .locator('[data-slot="tooltip-content"][data-variant="pill"]')
    .filter({ hasText: place.name });
  await pill.waitFor({ timeout: 2000 });
  await page.waitForTimeout(200);
  const look = await pill.evaluate((el) => {
    const style = getComputedStyle(el);
    const shell = getComputedStyle(document.querySelector('[data-slot="sidebar-inner"]'));
    const hint = el.querySelector("span");
    return {
      words: el.textContent,
      text: style.color,
      hint: hint === null ? style.color : getComputedStyle(hint).color,
      fill: style.backgroundColor,
      shell: shell.backgroundColor,
      round: Number.parseFloat(style.borderRadius) >= el.getBoundingClientRect().height / 2,
      arrow: el.querySelector("[data-side], svg") !== null,
      instant: el.dataset.instant ?? null,
    };
  });
  return {
    ...look,
    onText: contrast(look.text, look.fill),
    hintOnFill: contrast(look.hint, look.fill),
    onShell: contrast(look.fill, look.shell),
  };
}

// Whether a pill says what its place is, in the ink pill's look, legibly.
function pillReads({ name, soon }, pill) {
  const words = soon === true ? `${name} · ${SOON}` : name;
  return (
    pill.words === words &&
    pill.onText >= 7 &&
    pill.hintOnFill >= 4.5 &&
    pill.onShell >= 3 &&
    pill.round === true &&
    pill.arrow === false &&
    (name === "Kay" || pill.instant === "delay")
  );
}

// The places a sidebar header draws: the sidebar's own, or the rail echo's beneath it.
const placesIn = (page, host) =>
  page.locator(`${host} [data-sidebar="header"]`).evaluate(readPlaces);
const glyphsOf = (places) => JSON.stringify(places.map((place) => place.glyph));

// P25's layout half: the places as the rail draws them at rest, as its echo does beneath it, as
// the peek does, and pinned open.
async function placesEverywhere(browser, theme) {
  const rail = await openDesk(browser, { theme });
  await rail.page.mouse.move(900, 400);
  const collapsed = await placesIn(rail.page, '[data-slot="sidebar"]');
  const echo = await placesIn(rail.page, '[data-slot="rail-echo"]');
  await peek(rail.page);
  const peeking = await placesIn(rail.page, '[data-slot="sidebar"]');
  await rail.context.close();
  const open = await openDesk(browser, { side: "open", theme });
  const pinned = await placesIn(open.page, '[data-slot="sidebar"]');
  await open.context.close();
  return { collapsed, echo, peeking, pinned };
}

// P25's verdict on where the places are: in order by name, role and glyph, the places not built
// yet announced as unavailable and linking nowhere, every glyph on one pixel in all four views.
function placesVerdict({ collapsed, echo, peeking, pinned }) {
  const want = JSON.stringify(RAIL_PLACES.map(({ name, role, icon }) => [name, role, icon]));
  const got = JSON.stringify(collapsed.map(({ name, role, icon }) => [name, role, icon]));
  const announced = collapsed.every((place, i) =>
    RAIL_PLACES.at(i)?.soon === true
      ? place.disabled === "true" && place.href === null && place.description === SOON
      : place.disabled === null,
  );
  const views = [echo, peeking, pinned].map((view) => glyphsOf(view));
  const oneSpot =
    collapsed.length === RAIL_PLACES.length && views.every((view) => view === glyphsOf(collapsed));
  return {
    ok: got === want && announced === true && oneSpot,
    note: `order ${got === want}${got === want ? "" : ` ${got}`}; announced ${announced}; glyphs on one pixel collapsed, echo, peek and open ${oneSpot}`,
  };
}

// A place's fill, its glyph's ink, its cursor and the shell behind it.
const lookOf = (locator) =>
  locator.evaluate((el) => {
    const style = getComputedStyle(el);
    const shell = document.querySelector('[data-slot="sidebar-inner"]');
    return {
      fill: style.backgroundColor,
      ink: getComputedStyle(el.querySelector("svg")).color,
      cursor: style.cursor,
      shell: getComputedStyle(shell).backgroundColor,
    };
  });

// P25's pointer half: resting on a place not built yet in the collapsed rail, long past the
// peek's open delay, keeps it as it was (no fill, no step to ink, the arrow cursor) and keeps
// the sidebar in its rail. A place the rail lacks is noted as missing.
async function restOnSoon(page) {
  const seen = [];
  for (const place of SOON_PLACES) {
    const target = placeOf(page, place);
    if ((await target.count()) === 0) {
      seen.push({ name: place.name, missing: true });
      continue;
    }
    await page.mouse.move(900, 400);
    await page.waitForTimeout(CLOSE_MS);
    const rest = await lookOf(target);
    const box = await target.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 });
    await page.waitForTimeout(OPEN_MS * 3 + SLIDE_MS);
    seen.push({ name: place.name, rest, hover: await lookOf(target), phase: await phaseOf(page) });
  }
  return seen;
}

// Whether resting changed nothing, and the faint ink clears text's 4.5:1 on the shell.
const restsQuietly = ({ missing, rest, hover, phase }) =>
  missing !== true &&
  rest.fill === "rgba(0, 0, 0, 0)" &&
  hover.fill === rest.fill &&
  hover.ink === rest.ink &&
  hover.cursor === "default" &&
  phase === "rail" &&
  contrast(rest.ink, rest.shell) >= 4.5;

// P25's keyboard and press half: Tab walks from Kay through the places not built yet to the
// documentation link, and a click, Enter or Space on each opens nothing: the address, the open
// pages and the absence of any menu or dialog all hold.
async function pressSoon(context, page) {
  const before = page.url();
  await placeOf(page, RAIL_PLACES[0]).focus();
  const walked = [];
  for (let step = 1; step < RAIL_PLACES.length - 1; step++) {
    await page.keyboard.press("Tab");
    walked.push(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")));
  }
  let pressed = 0;
  for (const place of SOON_PLACES) {
    const target = placeOf(page, place);
    if ((await target.count()) === 0) continue;
    await target.click({ force: true });
    await target.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    pressed += 1;
  }
  await page.waitForTimeout(300);
  return {
    walked,
    pressed,
    stayed: page.url() === before,
    pages: context.pages().length,
    popups: await page.locator('[role="menu"], [role="dialog"]').count(),
  };
}

// Whether Tab walked the places in order and no press went anywhere.
const pressesInert = (presses) =>
  presses.walked.join("|") === WALK.join("|") &&
  presses.pressed === SOON_PLACES.length &&
  presses.stayed === true &&
  presses.pages === 1 &&
  presses.popups === 0;

// P25's open half: at the sidebar's narrowest, each place not built yet shows its whole name
// and "Soon" after it, clear of the name by the button's gap and inside its padding, both in
// faint ink at 4.5:1 or more.
async function soonRows(browser, theme) {
  const { context, page } = await openDesk(browser, { side: "open", width: NARROWEST, theme });
  await page.mouse.move(900, 400);
  const header = page.locator('[data-slot="sidebar"] [data-sidebar="header"]');
  const rows = await header.evaluate(readSoonRows);
  await header.screenshot({ path: shotPath(`P25-open-${NARROWEST}-${theme}`) });
  await context.close();
  return rows;
}

// Whether a row shows its name whole and its hint beside it, legibly.
const rowReads = (row) =>
  row.whole === true &&
  row.tag === SOON_SHORT &&
  row.shown === true &&
  row.tagBox.left >= row.label.right + PLACE_GAP - 0.5 &&
  row.tagBox.right <= row.button.right - PLACE_PAD + 0.5 &&
  contrast(row.labelInk, row.shell) >= 4.5 &&
  contrast(row.tagInk, row.shell) >= 4.5;

/** The workspace lever's checks of the rail's places, by id. */
export const railChecks = {
  // The collapsed rail names every place in an ink pill, 7:1 for its text and 3:1 against the
  // shell in either theme, and a place not built yet adds a softer "· Coming soon" that still
  // clears 4.5:1; the next place's pill opens at once; none while the sidebar peeks.
  async P23(browser) {
    const notes = [];
    let ok = true;
    for (const theme of ["light", "dark"]) {
      const { context, page } = await openDesk(browser, { theme });
      await page.mouse.move(900, 300);
      for (const place of RAIL_PLACES) {
        const pill = await pillOn(page, place);
        if (pill === null) {
          ok = false;
          notes.push(`${theme} ${place.name}: missing`);
          continue;
        }
        await page.screenshot({
          path: shotPath(`P23-pill-${place.name.replaceAll(" ", "-")}-${theme}`),
          clip: { x: 0, y: 40, width: 320, height: 420 },
        });
        ok &&= pillReads(place, pill);
        notes.push(
          `${theme} ${JSON.stringify(pill.words)}: text ${round(pill.onText)}:1, hint ${round(pill.hintOnFill)}:1, shell ${round(pill.onShell)}:1, round ${pill.round}, arrow ${pill.arrow}, instant ${pill.instant}`,
        );
      }
      await peek(page);
      const lab = await page
        .locator('[data-slot="sidebar"]')
        .getByRole("link", { name: "Lab" })
        .boundingBox();
      await page.mouse.move(lab.x + 20, lab.y + 20, { steps: 2 });
      await page.waitForTimeout(700);
      const whilePeeking = await page
        .locator('[data-slot="tooltip-content"][data-variant="pill"]:visible')
        .count();
      ok &&= whilePeeking === 0;
      notes.push(`${theme} pills while peeking ${whilePeeking}`);
      await context.close();
    }
    return { ok, detail: notes.join("; ") };
  },

  // The rail's places in order under Kay (ADR-094, amended), and the five the web build does not
  // have yet: named ("Memory", dimmed, "Coming soon" to a screen reader), in the tab order, and
  // inert. Resting on one names it and neither fills it nor peeks; a click, Enter or Space opens
  // nothing; open, each says "Soon" beside its whole name even at 208px; faint ink clears 4.5:1
  // in either theme; and every place's glyph sits on one pixel collapsed, in the rail's echo,
  // peeking and open.
  async P25(browser) {
    const notes = [];
    let ok = true;
    for (const theme of ["light", "dark"]) {
      const places = placesVerdict(await placesEverywhere(browser, theme));
      const { context, page } = await openDesk(browser, { theme });
      const rests = await restOnSoon(page);
      const presses = await pressSoon(context, page);
      await context.close();
      const rows = await soonRows(browser, theme);
      const quiet = rests.every((rest) => restsQuietly(rest));
      const inert = pressesInert(presses);
      const readable = rows.length === SOON_PLACES.length && rows.every((row) => rowReads(row));
      ok &&= places.ok && quiet && inert && readable;
      const inks = rests
        .filter((r) => r.missing !== true)
        .map((r) => round(contrast(r.rest.ink, r.rest.shell)));
      notes.push(
        `${theme}: ${places.note}; resting quiet ${quiet} (ink ${inks.length === 0 ? "none" : `${Math.min(...inks)}:1`}, peek ${rests.map((r) => r.phase ?? "missing").join(",")}); Tab ${presses.walked.join(" > ")}; ${presses.pressed} pressed, stay ${presses.stayed}, pages ${presses.pages}, popups ${presses.popups}; open at ${NARROWEST}px ${readable} (${rows.map((r) => `${r.name} ${round(r.tagBox.left - r.label.right)}px ${r.tag}`).join(", ")})`,
      );
    }
    return { ok, detail: notes.join("; ") };
  },
};
