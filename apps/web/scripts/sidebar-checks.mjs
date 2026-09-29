// Checks for the sidebar's peek, its resizable edge, the title bar's tabs that follow that edge,
// and the collapsed rail's name pills, on a desktop window with motion on.
import { BASE, shotPath } from "./lever.mjs";

const DEMO = `${BASE}/?scenario=demo`;
const DESK = { width: 1440, height: 900 };
// The peek's slide and its curve (index.css), and its timing (peek.ts).
const SLIDE_MS = 220;
const DRAWER = "cubic-bezier(0.32, 0.72, 0, 1)";
const OPEN_MS = 80;
const CLOSE_MS = 250;
// The tabs start this far past the sidebar's edge (title-bar.tsx).
const TAB_INSET = 4;
const TOGGLE = 'header [data-sidebar="trigger"]';

const round = (n) => Math.round(n * 100) / 100;
const phaseOf = (page) =>
  page.evaluate(() => document.querySelector('[data-slot="sidebar"]').dataset.peek ?? "rail");
// The first tab's left and the workspace's (the sidebar's edge), in CSS px.
const edges = (page) =>
  page.evaluate(() => ({
    tab: document.querySelector('[role="tab"]').getBoundingClientRect().x,
    edge: document.querySelector('[role="main"]').getBoundingClientRect().x,
  }));

// A fresh desktop window on the demo, the sidebar open or collapsed, at a kept width, in a
// theme, with motion on unless asked.
async function openDesk(
  browser,
  { side = "closed", width, theme = "light", motion = "no-preference" } = {},
) {
  const context = await browser.newContext({
    viewport: DESK,
    deviceScaleFactor: 2,
    reducedMotion: motion,
  });
  await context.addInitScript(
    ([t, s, w]) => {
      localStorage.setItem("theme", t);
      localStorage.setItem("kay.sidebar", s);
      // An absent width arrives as null (the arguments go over the wire as JSON).
      if (typeof w === "number") localStorage.setItem("kay.sidebar-width", String(w));
    },
    [theme, side, width],
  );
  const page = await context.newPage();
  await page.goto(DEMO);
  await page
    .locator('[data-slot="sidebar"] [data-thread]')
    .first()
    .waitFor({ state: "attached", timeout: 20_000 });
  await page.waitForTimeout(400);
  return { context, page };
}

// Rests the pointer on the collapsed rail's empty stretch until the peek is out.
async function peek(page) {
  await page.mouse.move(900, 500);
  await page.mouse.move(28, 650, { steps: 3 });
  await page.waitForFunction(
    () => document.querySelector('[data-slot="sidebar"]').dataset.peek === "open",
  );
  await page.waitForTimeout(SLIDE_MS + 100);
}

// The container's running transitions, as property, duration and easing.
const transitions = (page) =>
  page.evaluate(() =>
    document
      .querySelector('[data-slot="sidebar-container"]')
      .getAnimations()
      .map((a) =>
        [a.transitionProperty, a.effect.getTiming().duration, a.effect.getTiming().easing].join(
          " ",
        ),
      ),
  );

// Samples the first tab's offset from the sidebar's edge on every frame for `ms`.
function sampleOffsets(page, ms) {
  return page.evaluate(
    (span) =>
      new Promise((done) => {
        const seen = [];
        const start = performance.now();
        const tick = () => {
          const tab = document.querySelector('[role="tab"]').getBoundingClientRect().x;
          const edge = document.querySelector('[role="main"]').getBoundingClientRect().x;
          seen.push({ tab, edge });
          if (performance.now() - start < span) requestAnimationFrame(tick);
          else done(seen);
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

// A computed rgb() colour's channels, and its relative luminance (WCAG).
const channels = (css) =>
  css
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number);
function luminance(css) {
  const [r, g, b] = channels(css).map((v) => {
    const c = v / 255;
    return c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG's contrast of two computed rgb() colours.
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// P19's pointer half: resting on the toggle slides the whole sidebar out over the workspace
// in 220ms on the drawer curve, moving nothing beneath; passing over it does not; leaving
// closes it after the grace; the strip past the rail opens it too.
async function peekByPointer(page) {
  const before = await edges(page);
  const toggle = await page.locator(TOGGLE).boundingBox();
  await page.mouse.move(toggle.x - 40, toggle.y + 14);
  await page.mouse.move(toggle.x + 80, toggle.y + 14, { steps: 2 });
  await page.waitForTimeout(OPEN_MS * 3);
  const passed = await phaseOf(page);
  await page.mouse.move(toggle.x + 14, toggle.y + 14);
  await page.waitForFunction(
    () => document.querySelector('[data-slot="sidebar"]').dataset.peek === "open",
  );
  const slide = await transitions(page);
  await page.waitForTimeout(SLIDE_MS + 100);
  const during = await edges(page);
  const panel = await page.locator('[data-slot="sidebar-container"]').boundingBox();
  await page.screenshot({
    path: shotPath("P19-peek"),
    clip: { x: 0, y: 0, width: 720, height: 600 },
  });
  await page.mouse.move(900, 500);
  await page.waitForTimeout(CLOSE_MS - 100);
  const graced = await phaseOf(page);
  await page.waitForTimeout(600);
  const closed = await phaseOf(page);
  await page.mouse.move(76, 500, { steps: 3 });
  await page.waitForTimeout(OPEN_MS + SLIDE_MS + 100);
  const hot = await phaseOf(page);
  const ok =
    passed === "rail" &&
    slide.includes(`transform ${SLIDE_MS} ${DRAWER}`) &&
    before.tab === during.tab &&
    before.edge === during.edge &&
    panel.width >= 208 &&
    graced === "open" &&
    closed === "rail" &&
    hot === "open";
  return {
    ok,
    note: `quick pass ${passed}; slide [${slide.join(", ")}]; beneath ${JSON.stringify(before)}→${JSON.stringify(during)}; panel ${panel.width}px; ${CLOSE_MS - 100}ms after leaving ${graced}, then ${closed}; strip past the rail ${hot}`,
  };
}

// P19's keyboard and menu half: the account menu holds the peek out with the pointer away;
// Escape closes it at once; one navigation landmark named Sidebar throughout.
async function peekHolds(page) {
  await peek(page);
  const landmarks = await page.getByRole("navigation", { name: "Sidebar" }).count();
  await page.locator('[data-slot="sidebar"]').getByRole("button", { name: "Account" }).click();
  await page.mouse.move(900, 300);
  await page.waitForTimeout(CLOSE_MS + 300);
  const held = await phaseOf(page);
  // The first Escape closes the menu, which hands focus back to the account; the next closes
  // the peek.
  await page.keyboard.press("Escape");
  await page.getByRole("menu").waitFor({ state: "detached" });
  const focus = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  await page.keyboard.press("Escape");
  const escaped = await phaseOf(page);
  const running = await transitions(page);
  return {
    ok: landmarks === 1 && held === "open" && escaped === "rail" && running.length === 0,
    note: `landmarks named Sidebar ${landmarks}; menu up, pointer away: ${held}; menu closed, focus on ${focus}; Escape: ${escaped}, running [${running.join(", ")}]`,
  };
}

// P21's drag: the width follows the pointer between the clamps, the first tab stays 4px past
// the edge on every frame, and the width is kept on release.
async function dragPinned(page) {
  const handle = page.getByRole("separator", { name: "Resize the sidebar" });
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + 0.5, 500);
  await page.mouse.down();
  const frames = sampleOffsets(page, 1200);
  for (let x = box.x; x <= box.x + 400; x += 16) await page.mouse.move(x, 500);
  const widest = (await page.locator('[data-slot="sidebar-container"]').boundingBox()).width;
  for (let x = box.x + 400; x >= box.x - 200; x -= 16) await page.mouse.move(x, 500);
  const narrowest = (await page.locator('[data-slot="sidebar-container"]').boundingBox()).width;
  await page.mouse.move(box.x + 144, 500, { steps: 8 });
  await page.mouse.up();
  const offsets = (await frames).map((f) => round(f.tab - f.edge));
  const kept = await page.evaluate(() => localStorage.getItem("kay.sidebar-width"));
  return { widest, narrowest, offsets, kept, handle };
}

// P22's pin: the tab strip moves in step with the sidebar's own width transition. On every
// frame the first tab is 4px past the edge, or after the toggle while the edge is short of it
// (`cluster`, the collapsed tab's x); returns the largest miss in px.
async function pinInStep(page, cluster) {
  const frames = sampleOffsets(page, 450);
  await page.locator(TOGGLE).click();
  const seen = await frames;
  return Math.max(...seen.map((f) => Math.abs(f.tab - Math.max(cluster, f.edge + TAB_INSET))));
}

// The pill a rail place shows once the pointer has rested on it, measured against the shell.
async function pillOn(page, name) {
  const place = page.locator('[data-slot="sidebar"]').getByRole("link", { name, exact: true });
  const box = await place.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 });
  const pill = page.locator('[data-slot="tooltip-content"][data-variant="pill"]');
  await pill.filter({ hasText: name }).waitFor({ timeout: 2000 });
  await page.waitForTimeout(200);
  const look = await pill.filter({ hasText: name }).evaluate((el) => {
    const style = getComputedStyle(el);
    const shell = getComputedStyle(document.querySelector('[data-slot="sidebar-inner"]'));
    return {
      text: style.color,
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
    onShell: contrast(look.fill, look.shell),
  };
}

export const sidebarChecks = {
  // The peek (ADR-094's sidebar, collapsed): out on hover of the toggle, the rail or the strip
  // past it, back after the grace, held by a menu, closed at once by Escape.
  async P19(browser) {
    const results = [];
    for (const step of [peekByPointer, peekHolds]) {
      const { context, page } = await openDesk(browser);
      results.push(await step(page));
      await context.close();
    }
    return { ok: results.every((r) => r.ok), detail: results.map((r) => r.note).join("; ") };
  },

  // No motion where motion is not wanted: reduced motion peeks by a fade alone, and a key's
  // pin or unpin (Enter on the toggle, Ctrl+B) moves nothing.
  async P20(browser) {
    const reduced = await openDesk(browser, { motion: "reduce" });
    await reduced.page.mouse.move(900, 500);
    await reduced.page.mouse.move(28, 650, { steps: 3 });
    await reduced.page.waitForFunction(
      () => document.querySelector('[data-slot="sidebar"]').dataset.peek === "open",
    );
    const fade = await transitions(reduced.page);
    await reduced.context.close();
    const keys = await openDesk(browser, { side: "open" });
    await keys.page.locator(TOGGLE).focus();
    await keys.page.keyboard.press("Enter");
    const enter = await keys.page.evaluate(
      () => document.getAnimations().filter((a) => a.transitionProperty === "width").length,
    );
    await keys.page.keyboard.press("Control+b");
    const shortcut = await keys.page.evaluate(
      () => document.getAnimations().filter((a) => a.transitionProperty === "width").length,
    );
    await keys.context.close();
    const fadeOnly = fade.length > 0 && fade.every((each) => each.startsWith("opacity"));
    return {
      ok: fadeOnly && enter === 0 && shortcut === 0,
      detail: `reduced motion [${fade.join(", ")}]; width transitions after Enter ${enter}, after Ctrl+B ${shortcut}`,
    };
  },

  // The sidebar's edge resizes it: drag (clamped 208 to 480px, kept, and read back after a
  // reload), arrows, Home and End, a double click back to 256px, and in the peek.
  async P21(browser) {
    const { context, page } = await openDesk(browser, { side: "open" });
    const drag = await dragPinned(page);
    await page.reload();
    await page.getByRole("separator", { name: "Resize the sidebar" }).waitFor();
    const reloaded = await drag.handle.getAttribute("aria-valuenow");
    await drag.handle.focus();
    const steps = [];
    for (const key of ["ArrowRight", "Shift+ArrowLeft", "Home", "End"]) {
      await page.keyboard.press(key);
      steps.push(await drag.handle.getAttribute("aria-valuenow"));
    }
    const hb = await drag.handle.boundingBox();
    await page.mouse.dblclick(hb.x + 0.5, 400);
    await page.waitForTimeout(300);
    const reset = await drag.handle.getAttribute("aria-valuenow");
    await context.close();
    const peeked = await openDesk(browser);
    await peek(peeked.page);
    const beneath = await edges(peeked.page);
    const pb = await peeked.page
      .getByRole("separator", { name: "Resize the sidebar" })
      .boundingBox();
    await peeked.page.mouse.move(pb.x + 0.5, 500, { steps: 2 });
    await peeked.page.mouse.down();
    await peeked.page.mouse.move(pb.x + 100, 500, { steps: 6 });
    await peeked.page.mouse.up();
    const widened = (await peeked.page.locator('[data-slot="sidebar-container"]').boundingBox())
      .width;
    const still = await edges(peeked.page);
    await peeked.context.close();
    const inStep = drag.offsets.every((o) => o === TAB_INSET);
    const ok =
      drag.widest === 480 &&
      drag.narrowest === 208 &&
      inStep &&
      drag.kept === reloaded &&
      steps.join() === `${Number(reloaded) + 16},${Number(reloaded) - 48},208,480` &&
      reset === "256" &&
      widened >= 256 + 90 &&
      still.tab === beneath.tab &&
      still.edge === beneath.edge;
    return {
      ok,
      detail: `drag ${drag.narrowest}..${drag.widest}px; tab offset on ${drag.offsets.length} frames ${Math.min(...drag.offsets)}..${Math.max(...drag.offsets)}; kept ${drag.kept}, after reload ${reloaded}; keys ${steps.join(",")}; double click ${reset}; peek widened to ${widened}px, beneath ${JSON.stringify(beneath)}→${JSON.stringify(still)}`,
    };
  },

  // The tabs start 4px past the sidebar's edge at any width, in either theme; collapsed they
  // start after the toggle and stay put while the sidebar peeks; pinning moves them in step.
  async P22(browser) {
    const notes = [];
    let ok = true;
    for (const theme of ["light", "dark"]) {
      for (const width of [208, 256, 400]) {
        const { context, page } = await openDesk(browser, { side: "open", width, theme });
        const { tab, edge } = await edges(page);
        await page.screenshot({
          path: shotPath(`P22-tabs-${theme}-${width}`),
          clip: { x: edge - 120, y: 0, width: 360, height: 160 },
        });
        ok &&= round(tab - edge) === TAB_INSET;
        notes.push(`${theme} ${width}px: ${round(tab - edge)}px`);
        await context.close();
      }
    }
    const { context, page } = await openDesk(browser);
    const rail = await edges(page);
    const afterToggle = (await page.locator(TOGGLE).boundingBox()).x + 28;
    await peek(page);
    const peeking = await edges(page);
    await page.mouse.move(900, 500);
    await page.waitForTimeout(CLOSE_MS + SLIDE_MS + 300);
    const drift = await pinInStep(page, rail.tab);
    await context.close();
    ok &&= rail.tab > afterToggle && rail.tab === peeking.tab && drift < 0.5;
    notes.push(
      `collapsed ${round(rail.tab)} after the toggle ${rail.tab > afterToggle}, peeking ${round(peeking.tab)}; pin drift ${round(drift)}px`,
    );
    return { ok, detail: notes.join("; ") };
  },

  // The collapsed rail names each place in an ink pill, 7:1 for its text and 3:1 against the
  // shell in either theme; the next place's pill opens at once; none while the sidebar peeks.
  async P23(browser) {
    const notes = [];
    let ok = true;
    for (const theme of ["light", "dark"]) {
      const { context, page } = await openDesk(browser, { theme });
      await page.mouse.move(900, 300);
      for (const name of ["Kay", "Documentation", "Lab"]) {
        const pill = await pillOn(page, name);
        await page.screenshot({
          path: shotPath(`P23-pill-${name}-${theme}`),
          clip: { x: 0, y: 40, width: 320, height: 240 },
        });
        const good = pill.onText >= 7 && pill.onShell >= 3 && pill.round && !pill.arrow;
        ok &&= good && (name === "Kay" || pill.instant === "delay");
        notes.push(
          `${theme} ${name}: text ${round(pill.onText)}:1, shell ${round(pill.onShell)}:1, round ${pill.round}, arrow ${pill.arrow}, instant ${pill.instant}`,
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
};
