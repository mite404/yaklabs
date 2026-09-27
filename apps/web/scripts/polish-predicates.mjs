// The shell polish's acceptance predicates, one check per section of
// docs/reference/shell-polish/tasks.md (A to K). Each returns { ok, detail } and runs in its
// own contexts, so one failure never hides another.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { carry, selectReply } from "./canvas-checks.mjs";
import { ROOT } from "./harness.mjs";
import { shotPath } from "./lever.mjs";
import {
  boxesOf,
  canvasIn,
  openScenario,
  pixelsOf,
  ratio,
  readBaseline,
  rgbOf,
  running,
  settle,
  shot,
  shown,
  sidebar,
  tabs,
  THEMES,
  titleBar,
  toEmpty,
  toLanes,
  tokenColour,
  WIDTHS,
  worst,
} from "./polish-checks.mjs";

const VARIANTS = ["solid", "painting"];
// The baseline was shot with the window 8px in; it now sits 16px in (ADR-106). A viewport 16px
// larger gives the window the baseline's exact size, so boxes and pixels compare one to one.
const GROWN = { width: 1456, height: 916 };
// The trim draws 2px over the body's edge (ADR-107); pixel comparisons leave that band out.
const TRIM = 2;

const query = (variant) => `chrome=${variant}`;
const inside = (r, x, y) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
// A box now, moved back by the window's 8px deeper inset, to compare with the baseline's.
const shift = (box) => ({ ...box, x: box.x - 8, y: box.y - 8 });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const round = (n) => Math.round(n * 100) / 100;
const min = (list) => (list.length === 0 ? Infinity : Math.min(...list));
const splash = (page) => shown(page).locator('[data-slot="canvas-splash"]');
const kay = (page) => shown(page).locator('[data-slot="kay-mascot"]');
const openSpace = (page) => canvasIn(page).locator(":scope > [data-ground]").first();
const lanes = (page) => canvasIn(page).locator(":scope > article");

// Every visible ink in `scope`: each node's own text, by the rectangle its glyphs fill, and
// each icon, by its box less whatever a later sibling paints over it (the bell's badge). A node
// faded out or hidden, or inside one, as a close button is at rest, is not an ink.
/* oxlint-disable unicorn/consistent-function-scoping -- the callback is serialized into the page,
   so its helpers have to live inside it */
function inksOf(scope) {
  return scope.evaluate((root) => {
    const found = [];
    const shownEl = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      for (let at = el; at !== null; at = at.parentElement) {
        const style = getComputedStyle(at);
        if (style.opacity === "0" || style.visibility !== "visible") return false;
      }
      return el.closest(".sr-only") === null;
    };
    // A box cut to what its clipping ancestors show, and to the unfaded middle of the tab strip:
    // a label scrolled out of view is not an ink, and the fade at an edge is the cue that more
    // tabs lie past it.
    const plain = (r, el) => {
      let [left, top, right, bottom] = [r.left, r.top, r.right, r.bottom];
      for (let at = el; at !== null && at !== root.parentElement; at = at.parentElement) {
        const style = getComputedStyle(at);
        if (style.overflowX === "visible" && style.overflowY === "visible") continue;
        const clip = at.getBoundingClientRect();
        const fade =
          at.classList.contains("tab-scroller") && at.scrollWidth > at.clientWidth ? 32 : 0;
        [left, top, right, bottom] = [
          Math.max(left, clip.left + fade),
          Math.max(top, clip.top),
          Math.min(right, clip.right - fade),
          Math.min(bottom, clip.bottom),
        ];
      }
      return {
        x: left,
        y: top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    };
    for (const el of root.querySelectorAll("*")) {
      if (!shownEl(el)) continue;
      const colour = getComputedStyle(el).color;
      if (el.tagName.toLowerCase() === "svg") {
        const covers = [];
        for (let next = el.nextElementSibling; next !== null; next = next.nextElementSibling)
          covers.push(plain(next.getBoundingClientRect(), el.parentElement));
        found.push({
          kind: "icon",
          colour,
          rect: plain(el.getBoundingClientRect(), el.parentElement),
          covers,
          label: el.getAttribute("class"),
        });
        continue;
      }
      for (const node of el.childNodes) {
        if (node.nodeType !== 3 || node.textContent.trim() === "") continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        found.push({
          kind: "text",
          colour,
          rect: plain(range.getBoundingClientRect(), el),
          covers: [],
          label: node.textContent.trim().slice(0, 24),
        });
      }
    }
    return found;
  });
}
/* oxlint-enable unicorn/consistent-function-scoping */

// worst() for every ink in `scope` at once: one picture of the scope with every glyph and icon
// taken away, then each ink against the pixels under it. Text needs 4.5, icons 3.0 (ADR-065).
async function inkReport(page, scope) {
  const list = await inksOf(scope);
  const box = await scope.boundingBox();
  await scope.evaluate((el) => {
    el.dataset.polishScope = "";
  });
  const style = await page.addStyleTag({
    content:
      "[data-polish-scope] *{color:transparent!important;-webkit-text-fill-color:transparent!important} [data-polish-scope] svg{visibility:hidden!important}",
  });
  const png = await page.screenshot({ clip: box, animations: "disabled", caret: "hide" });
  await style.evaluate((node) => {
    node.remove();
  });
  await scope.evaluate((el) => {
    delete el.dataset.polishScope;
  });
  const { pixels, width } = await pixelsOf(page, png);
  const failures = [];
  const worstOf = { text: [], icon: [] };
  for (const ink of list) {
    const fg = rgbOf(ink.colour);
    let lowest = Infinity;
    for (let y = Math.floor(ink.rect.y); y < Math.ceil(ink.rect.y + ink.rect.height); y += 1) {
      for (let x = Math.floor(ink.rect.x); x < Math.ceil(ink.rect.x + ink.rect.width); x += 1) {
        if (ink.covers.some((r) => inside(r, x + 0.5, y + 0.5))) continue;
        const [px, py] = [Math.round(x - box.x), Math.round(y - box.y)];
        if (px < 0 || py < 0 || px >= width) continue;
        const pixel = pixels[py * width + px];
        if (pixel !== undefined) lowest = Math.min(lowest, ratio(fg, pixel));
      }
    }
    lowest = round(lowest);
    worstOf[ink.kind].push(lowest);
    if (lowest < (ink.kind === "text" ? 4.5 : 3))
      failures.push(`${ink.kind} "${ink.label}" ${lowest}`);
  }
  return { text: min(worstOf.text), icons: min(worstOf.icon), failures };
}

// The pixels of two PNGs, compared with a band of `inset` pixels at each edge left out, and
// with it the 12px squares at the bottom corners where the trim bends round the window's corners.
async function samePixels(page, a, b, inset = 0, topCorners = 0) {
  const [pa, pb] = [await pixelsOf(page, a), await pixelsOf(page, b)];
  if (pa.width !== pb.width || pa.height !== pb.height) return { same: false, differ: -1 };
  let differ = 0;
  for (let y = inset; y < pa.height - inset; y += 1) {
    for (let x = inset; x < pa.width - inset; x += 1) {
      const corner = inset > 0 && y >= pa.height - 12 && (x < 12 || x >= pa.width - 12);
      const top = y < topCorners && (x < topCorners || x >= pa.width - topCorners);
      if (corner || top) continue;
      const i = y * pa.width + x;
      if (pa.pixels[i].some((c, k) => c !== pb.pixels[i][k])) differ += 1;
    }
  }
  return { same: differ === 0, differ };
}

async function pixelAt(page, x, y) {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  return (await pixelsOf(page, png)).pixels[0];
}

const barColour = async (page) =>
  rgbOf(await titleBar(page).evaluate((el) => getComputedStyle(el).backgroundColor));

export const polishChecks = {
  // Section 1: the solid bar.
  async A(browser) {
    const notes = [];
    let ok = true;
    for (const theme of THEMES) {
      const { page, context } = await openScenario(browser, { theme, query: query("solid") });
      const bg = await titleBar(page).evaluate((el) => getComputedStyle(el).backgroundColor);
      const chrome = await tokenColour(page, "--chrome");
      const a1 = bg === chrome && chrome === "rgb(59, 66, 60)";
      // Measured before the widths below, since a tab eases to its new width after a resize.
      const report = await inkReport(page, titleBar(page));
      const heights = [];
      for (const viewport of WIDTHS) {
        await page.setViewportSize(viewport);
        await settle(page);
        heights.push((await titleBar(page).boundingBox()).height);
      }
      const a2 = heights.every((h) => h === 44);
      const a3 = report.failures.length === 0;
      ok &&= a1 && a2 && a3;
      notes.push(
        `${theme}: A1 ${bg} ${a1}; A2 ${heights.join("/")}; A3 text ${report.text} icons ${report.icons} ${report.failures.join(", ")}`,
      );
      await context.close();
    }
    let hex = "";
    try {
      hex = execFileSync("rg", ["-n", "#[0-9a-fA-F]{3,8}\\b", "apps/web/src/shell"], {
        cwd: ROOT,
        encoding: "utf8",
      });
    } catch {
      hex = "";
    }
    const a4 = hex.trim() === "";
    const base = readBaseline().json.light;
    const a5 = [];
    for (const [scenario, key] of [
      ["demo", "bar"],
      ["long", "long"],
      ["loading", "loading"],
    ]) {
      const opened = await openScenario(browser, { scenario, ready: scenario === "demo" });
      if (scenario !== "demo") {
        await opened.page.locator('[data-slot="data-marker"]').waitFor();
        await opened.page.waitForTimeout(1500);
      }
      a5.push(`${scenario} ${(await titleBar(opened.page).ariaSnapshot()) === base[key].header}`);
      await opened.context.close();
    }
    ok &&= a4 && a5.every((each) => each.endsWith("true"));
    return { ok, detail: `${notes.join("; ")}; A4 no hex ${a4}; A5 ${a5.join(", ")}` };
  },

  // Section 2: the painted bar.
  async B(browser) {
    const notes = [];
    let ok = true;
    for (const theme of THEMES) {
      for (const viewport of WIDTHS.slice(0, 2)) {
        const { page, context } = await openScenario(browser, {
          theme,
          viewport,
          query: query("painting"),
        });
        const report = await inkReport(page, titleBar(page));
        ok &&= report.failures.length === 0;
        notes.push(
          `${theme} ${viewport.width}: text ${report.text} icons ${report.icons} ${report.failures.join(", ")}`,
        );
        await context.close();
      }
    }
    const long = await openScenario(browser, { scenario: "long", query: query("painting") });
    await tabs(long.page).last().scrollIntoViewIfNeeded();
    await settle(long.page);
    const longReport = await inkReport(long.page, titleBar(long.page));
    ok &&= longReport.failures.length === 0;
    notes.push(
      `long, last tab: text ${longReport.text} icons ${longReport.icons} ${longReport.failures.join(", ")}`,
    );
    await long.context.close();

    const fresh = await openScenario(browser, { query: query("painting"), ready: false });
    const before = (await titleBar(fresh.page).boundingBox())?.height;
    await fresh.page.locator('[data-slot="data-marker"]').waitFor();
    await settle(fresh.page);
    const size = await fresh.page.evaluate(
      () =>
        performance
          .getEntriesByType("resource")
          .find((entry) => entry.name.includes("/chrome/painting.webp"))?.transferSize ?? -1,
    );
    const after = (await titleBar(fresh.page).boundingBox()).height;
    const b2 = size > 0 && size <= 80_000 && before === 44 && after === 44;
    await fresh.context.close();

    let b3 = true;
    {
      const opened = await openScenario(browser, { query: query("painting"), ready: false });
      await opened.context.route("**/chrome/painting.webp", (route) => route.abort());
      await opened.page.reload();
      await opened.page.locator('[data-slot="data-marker"]').waitFor();
      await opened.page.getByRole("tab", { selected: true }).waitFor();
      await settle(opened.page);
      const report = await inkReport(opened.page, titleBar(opened.page));
      b3 = report.failures.length === 0;
      notes.push(`blocked: text ${report.text} icons ${report.icons}`);
      await opened.context.close();
    }
    const shots = [];
    for (let i = 0; i < 2; i += 1) {
      const opened = await openScenario(browser, { query: query("painting") });
      shots.push(await shot(titleBar(opened.page)));
      await opened.context.close();
    }
    const probe = await openScenario(browser, {});
    const b4diff = await samePixels(probe.page, shots[0], shots[1]);
    await probe.context.close();
    const b4 = b4diff.same;
    const credits = path.join(ROOT, "apps/web/public/chrome/CREDITS.md");
    const text = existsSync(credits) ? readFileSync(credits, "utf8") : "";
    const b5 = /painting/i.test(text) && /source/i.test(text) && /licen[cs]e/i.test(text);
    ok &&= b2 && b3 && b4 && b5;
    return {
      ok,
      detail: `B1 ${notes.join("; ")}; B2 ${size} bytes, 44 before ${before} after ${after} ${b2}; B3 ${b3}; B4 ${b4} (${b4diff.differ} px differ); B5 ${b5}`,
    };
  },

  // Section 3: the trim.
  async C(browser) {
    const notes = [];
    let ok = true;
    for (const theme of THEMES) {
      const { page, context } = await openScenario(browser, { theme });
      const body = page.locator('[data-slot="window-body"]');
      const look = await body.evaluate((el) => getComputedStyle(el, "::after").boxShadow);
      const trim = await tokenColour(page, "--trim");
      const c1 = look.includes("2px") && look.includes(trim);
      const bright = rgbOf(await tokenColour(page, "--bg"));
      const bar = await barColour(page);
      const c2 = Math.max(ratio(rgbOf(trim), bright), ratio(rgbOf(trim), bar)) >= 3;
      await page.locator("body").focus();
      const atRest = await body.evaluate((el) => getComputedStyle(el, "::after").boxShadow);
      await shown(page).getByRole("textbox").first().focus();
      const focused = await body.evaluate((el) => getComputedStyle(el, "::after").boxShadow);
      const c3 =
        atRest === focused &&
        trim !== (await tokenColour(page, "--focus")) &&
        trim !== (await tokenColour(page, "--ring"));
      ok &&= c1 && c2 && c3;
      notes.push(
        `${theme}: C1 ${c1}; C2 ${round(Math.max(ratio(rgbOf(trim), bright), ratio(rgbOf(trim), bar)))}; C3 ${c3}`,
      );
      await context.close();
    }
    const base = readBaseline().json.light.bar.boxes;
    const grown = await openScenario(browser, { viewport: GROWN });
    const now = await boxesOf(grown.page);
    const c4 =
      same(shift(now.tabpanel), base.tabpanel) &&
      same(shift(now.sidebar), base.sidebar) &&
      same(now.tabs.map(shift), base.tabs);
    await grown.context.close();
    const narrow = await openScenario(browser, { viewport: { width: 767, height: 900 } });
    const width = (await narrow.page.locator('[data-slot="window-body"]').boundingBox()).width;
    const drawn = await narrow.page
      .locator('[data-slot="window-body"]')
      .evaluate((el) => getComputedStyle(el, "::after").boxShadow.includes("2px"));
    const c5 = width === 767 && drawn;
    await narrow.context.close();
    ok &&= c4 && c5;
    return {
      ok,
      detail: `${notes.join("; ")}; C4 boxes as baseline ${c4}; C5 ${width}px drawn ${drawn}`,
    };
  },

  // Section 4: the tabs on the bar.
  async D(browser) {
    const notes = [];
    let ok = true;
    for (const theme of THEMES) {
      for (const variant of VARIANTS) {
        const { page, context } = await openScenario(browser, { theme, query: query(variant) });
        const labels = [];
        for (let i = 0; i < (await tabs(page).count()); i += 1) {
          labels.push((await inkReport(page, tabs(page).nth(i))).text);
          await tabs(page).nth(i).hover();
          await settle(page);
          labels.push((await inkReport(page, tabs(page).nth(i))).text);
          await page.mouse.move(700, 600);
          await settle(page);
        }
        const active = tabs(page).and(page.getByRole("tab", { selected: true }));
        const fill = rgbOf(await active.evaluate((el) => getComputedStyle(el).backgroundColor));
        const d2 =
          variant === "solid"
            ? ratio(fill, await barColour(page))
            : ratio(fill, rgbOf(await tokenColour(page, "--chrome-painting")));
        const d1 = min(labels) >= 4.5;
        ok &&= d1 && d2 >= 3;
        notes.push(`${theme} ${variant}: D1 ${min(labels)}; D2 ${round(d2)}`);
        await context.close();
      }
    }
    const grown = await openScenario(browser, { viewport: GROWN });
    const base = readBaseline().json.light.bar.boxes.tabs;
    const now = (await boxesOf(grown.page)).tabs.map(shift);
    const d3 = same(now, base);
    await grown.context.close();

    const long = await openScenario(browser, { scenario: "long", query: query("solid") });
    const scroller = long.page.locator(".tab-scroller");
    const mask = await scroller.evaluate((el) => getComputedStyle(el).maskImage);
    const box = await scroller.boundingBox();
    // The column 2px inside the faded right edge, top to bottom: the bar shows through, not
    // paper. Its median pixel is the bar; a glyph fading out may tint a few above it.
    const column = await pixelsOf(
      long.page,
      await long.page.screenshot({
        clip: { x: box.x + box.width - 3, y: box.y, width: 1, height: box.height },
      }),
    );
    const edge = column.pixels.toSorted((p, q) => p[1] - q[1])[
      Math.floor(column.pixels.length / 2)
    ];
    const bar = await barColour(long.page);
    const d4 = mask !== "none" && edge.every((c, i) => Math.abs(c - bar[i]) <= 2);
    await long.context.close();

    const loading = await openScenario(browser, { scenario: "loading", ready: false });
    await loading.page.locator('[data-slot="data-marker"]').waitFor();
    const skeleton = titleBar(loading.page).locator('[data-slot="skeleton"]');
    const skeletonFill = rgbOf(
      await skeleton.evaluate((el) => getComputedStyle(el).backgroundColor),
    );
    const d5 = ratio(skeletonFill, await barColour(loading.page));
    await loading.context.close();

    const keys = await openScenario(browser, {});
    const count = await tabs(keys.page).count();
    await tabs(keys.page).first().focus();
    await keys.page.keyboard.press("Delete");
    await keys.page.waitForTimeout(300);
    const afterDelete = await tabs(keys.page).count();
    await tabs(keys.page).first().click({ button: "middle" });
    await keys.page.waitForTimeout(300);
    const afterMiddle = await tabs(keys.page).count();
    const d6 = afterDelete === count - 1 && afterMiddle === count - 2;
    await keys.context.close();
    ok &&= d3 && d4 && d5 >= 1.2 && d6;
    return {
      ok,
      detail: `${notes.join("; ")}; D3 ${d3}; D4 mask ${mask !== "none"} edge ${edge} bar ${bar} ${d4}; D5 ${round(d5)}; D6 ${count}→${afterDelete}→${afterMiddle}`,
    };
  },

  // Section 5: the bell, the account and the rest of the bar.
  async E(browser) {
    const notes = [];
    let ok = true;
    for (const theme of THEMES) {
      const { page, context } = await openScenario(browser, { theme });
      const bar = await barColour(page);
      const badge = titleBar(page)
        .getByRole("button", { name: /^Notifications/ })
        .locator("span[aria-hidden]");
      const badgeFill = rgbOf(await badge.evaluate((el) => getComputedStyle(el).backgroundColor));
      const badgeText = rgbOf(await badge.evaluate((el) => getComputedStyle(el).color));
      const e2 = ratio(badgeFill, bar) >= 3 && ratio(badgeText, badgeFill) >= 4.5;
      const rings = [];
      for (const name of ["Toggle sidebar", /^Notifications/, "Account"]) {
        const control = titleBar(page).getByRole("button", { name });
        await page.locator("body").focus();
        for (let i = 0; i < 40; i += 1) {
          await page.keyboard.press("Tab");
          if (await control.evaluate((el) => el === document.activeElement)) break;
        }
        const cbox = await control.boundingBox();
        const png = await page.screenshot({
          clip: { x: cbox.x - 4, y: cbox.y - 4, width: cbox.width + 8, height: cbox.height + 8 },
        });
        const { pixels, width } = await pixelsOf(page, png);
        let best = 0;
        for (const [i, pixel] of pixels.entries()) {
          const [x, y] = [i % width, Math.floor(i / width)];
          const band = x < 4 || y < 4 || x >= width - 4 || y >= cbox.height + 4;
          if (band) best = Math.max(best, ratio(pixel, bar));
        }
        rings.push(round(best));
      }
      const e3 = rings.every((r) => r >= 3);
      await page.keyboard.press("Escape");
      await titleBar(page)
        .getByRole("button", { name: /^Notifications/ })
        .click();
      const menu = page.getByRole("menu");
      await menu.waitFor();
      const menuBg = await menu.evaluate((el) => getComputedStyle(el).backgroundColor);
      const itemInk = await menu
        .getByRole("menuitem")
        .first()
        .locator("span span")
        .nth(1)
        .evaluate((el) => getComputedStyle(el).color);
      const e4 =
        menuBg === (await tokenColour(page, "--compose-bg")) &&
        itemInk === (await tokenColour(page, "--ink"));
      await page.keyboard.press("Escape");
      const bell = await titleBar(page)
        .getByRole("button", { name: /^Notifications/ })
        .boundingBox();
      const account = await titleBar(page).getByRole("button", { name: "Account" }).boundingBox();
      const header = await titleBar(page).boundingBox();
      const e5 =
        bell.x + bell.width <= account.x &&
        header.x + header.width - (account.x + account.width) <= 12;
      const pressed = titleBar(page).locator('[aria-pressed="true"]');
      const pressedFill = rgbOf(
        await pressed.evaluate((el) => getComputedStyle(el).backgroundColor),
      );
      const e6 = ratio(pressedFill, bar) >= 3;
      const lights = await titleBar(page)
        .locator('[data-slot="traffic-lights"] span')
        .evaluateAll((els) =>
          els.map((el) => [
            getComputedStyle(el).borderTopColor,
            getComputedStyle(el).borderTopWidth,
            getComputedStyle(el).backgroundColor,
          ]),
        );
      const traffic = [
        await tokenColour(page, "--traffic-close"),
        await tokenColour(page, "--traffic-minimise"),
        await tokenColour(page, "--traffic-zoom"),
      ];
      const e7 = lights.every(([, w, fill], i) => w === "0px" && fill === traffic[i]);
      const right = await inkReport(page, titleBar(page).locator(":scope > div").last());
      const e1 = right.failures.length === 0;
      ok &&= e1 && e2 && e3 && e4 && e5 && e6 && e7;
      notes.push(
        `${theme}: E1 ${right.text}/${right.icons}; E2 ${round(ratio(badgeFill, bar))}/${round(ratio(badgeText, badgeFill))}; E3 ${rings.join("/")}; E4 ${menuBg} ${itemInk} ${e4}; E5 ${e5}; E6 ${round(ratio(pressedFill, bar))}; E7 ${e7}`,
      );
      await context.close();
    }
    {
      const long = await openScenario(browser, { scenario: "long" });
      const badge = titleBar(long.page)
        .getByRole("button", { name: /^Notifications/ })
        .locator("span[aria-hidden]");
      const text = await badge.innerText();
      const fill = rgbOf(await badge.evaluate((el) => getComputedStyle(el).backgroundColor));
      const ink = rgbOf(await badge.evaluate((el) => getComputedStyle(el).color));
      const e2long =
        text === "9+" && ratio(fill, await barColour(long.page)) >= 3 && ratio(ink, fill) >= 4.5;
      ok &&= e2long;
      notes.push(`long badge "${text}" ${e2long}`);
      await long.context.close();
    }
    {
      const painted = await openScenario(browser, { query: query("painting") });
      const right = await inkReport(
        painted.page,
        titleBar(painted.page).locator(":scope > div").last(),
      );
      ok &&= right.failures.length === 0;
      notes.push(`painting right group ${right.text}/${right.icons}`);
      await painted.context.close();
    }
    return { ok, detail: notes.join("; ") };
  },

  // Section 6: the window inside the browser.
  async F(browser) {
    const notes = [];
    let ok = true;
    for (const theme of THEMES) {
      const { page, context } = await openScenario(browser, { theme });
      for (const viewport of WIDTHS) {
        await page.setViewportSize(viewport);
        await settle(page);
        const win = await page.locator('[data-slot="window"]').boundingBox();
        const inset = viewport.width >= 768 ? 16 : 0;
        const f1 =
          win.x === inset &&
          win.y === inset &&
          win.width === viewport.width - 2 * inset &&
          win.height === viewport.height - 2 * inset;
        const radius = await page
          .locator('[data-slot="window"]')
          .evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
        const f2 = radius === (viewport.width >= 768 ? "12px" : "0px");
        const f5 = await page.evaluate(
          () =>
            document.scrollingElement.scrollWidth === innerWidth &&
            document.scrollingElement.scrollHeight === innerHeight,
        );
        ok &&= f1 && f2 && f5;
        if (!(f1 && f2 && f5))
          notes.push(`${theme} ${viewport.width}: F1 ${f1} F2 ${radius} F5 ${f5}`);
      }
      await page.setViewportSize(WIDTHS[0]);
      await settle(page);
      const ground = await pixelAt(page, 3, 3);
      const win = await page.locator('[data-slot="window"]').boundingBox();
      const body = await pixelAt(page, win.x + 12, win.y + win.height - 12);
      const bar = await barColour(page);
      const f3 = ratio(ground, body) >= 1.3 && ratio(ground, bar) >= 1.5;
      const corners = [
        await pixelAt(page, win.x + 1, win.y + 1),
        await pixelAt(page, win.x + win.width - 2, win.y + 1),
      ];
      // The window's shadow darkens the ground by a few levels right beside it; the bar's green
      // would be tens of levels away.
      const f4 = corners.every((c) => c.every((v, i) => Math.abs(v - ground[i]) <= 6));
      ok &&= f3 && f4;
      notes.push(
        `${theme}: F3 ${round(ratio(ground, body))}/${round(ratio(ground, bar))}; F4 ${f4}`,
      );
      await context.close();
    }
    return {
      ok,
      detail: `F1, F2, F5 at every width ${notes.every((n) => !n.includes("F1"))}; ${notes.join("; ")}`,
    };
  },

  // Section 7: the canvas splash.
  async G(browser) {
    const notes = [];
    let ok = true;
    const baseline = readBaseline();
    for (const theme of THEMES) {
      const { page, context } = await openScenario(browser, { theme });
      await toEmpty(page);
      const g1empty = await splash(page).count();
      const g3empty = (await canvasIn(page).ariaSnapshot()) === baseline.json[theme].empty.canvas;
      const words = await inkReport(page, openSpace(page));
      const button = openSpace(page).getByRole("button", { name: "Create blank thread" });
      const border = rgbOf(await button.evaluate((el) => getComputedStyle(el).borderTopColor));
      const g4 = [words.text, await worst(page, button, border, { mode: "hide" })];
      const drawing = shown(page).locator('[data-slot="splash-drawing"]');
      const box = await drawing.boundingBox();
      const hideOthers = await page.addStyleTag({
        content:
          '[data-slot="kay-mascot"],[data-ground] > p,[data-ground] > button{visibility:hidden!important}',
      });
      const withDrawing = await page.screenshot({ clip: box });
      await drawing.evaluate((el) => {
        el.style.visibility = "hidden";
      });
      const without = await page.screenshot({ clip: box });
      await drawing.evaluate((el) => {
        el.style.visibility = "";
      });
      await hideOthers.evaluate((node) => {
        node.remove();
      });
      const [a, b] = [await pixelsOf(page, withDrawing), await pixelsOf(page, without)];
      let darkest = 1;
      const w = a.width;
      const cornerSame = [
        [2, 2],
        [w - 3, 2],
        [2, a.height - 3],
        [w - 3, a.height - 3],
      ].every(([x, y]) => a.pixels[y * w + x].every((c, i) => c === b.pixels[y * w + x][i]));
      for (const [i, pixel] of a.pixels.entries()) {
        if (pixel.some((c, k) => c !== b.pixels[i][k]))
          darkest = Math.max(darkest, ratio(pixel, b.pixels[i]));
      }
      const g5 = darkest >= 1.05 && darkest <= 1.6;
      ok &&= g1empty === 1 && g3empty && g4[0] >= 4.5 && g4[1] >= 3 && g5 && cornerSame;
      notes.push(
        `${theme}: G1 empty ${g1empty}; G3 empty ${g3empty}; G4 ${g4.join("/")}; G5 ${round(darkest)}; G6 ${cornerSame}`,
      );
      if (theme === "light") await page.screenshot({ path: shotPath("G-empty-light") });
      await toLanes(page);
      const g1lanes = await splash(page).count();
      const g3lanes = (await canvasIn(page).ariaSnapshot()) === baseline.json[theme].lanes.canvas;
      ok &&= g1lanes === 0 && g3lanes;
      notes.push(`${theme}: G1 lanes ${g1lanes}; G3 lanes ${g3lanes}`);
      await context.close();

      const grown = await openScenario(browser, { theme, viewport: GROWN });
      await toLanes(grown.page);
      const now = await shot(canvasIn(grown.page));
      const g9 = await samePixels(grown.page, now, baseline.png(`lanes-canvas-${theme}`), TRIM);
      ok &&= g9.same;
      notes.push(`${theme}: G9 lanes canvas as baseline ${g9.same} (${g9.differ} px differ)`);
      await grown.context.close();
    }

    const { page, context } = await openScenario(browser, {});
    await toEmpty(page);
    await canvasIn(page).getByRole("button", { name: "Create blank thread" }).click();
    await lanes(page).first().waitFor();
    const afterCreate = await splash(page).count();
    await canvasIn(page)
      .getByRole("button", { name: /^Close / })
      .first()
      .click();
    await page.waitForTimeout(300);
    const afterClose = await splash(page).count();
    const g2 = afterCreate === 0 && afterClose === 1;

    const drops = [];
    const litBorders = [];
    const olive = await tokenColour(page, "--olive");
    for (const target of ["centre", "kay"]) {
      const spaceBox = await openSpace(page).boundingBox();
      const kayBox = await kay(page).boundingBox();
      const point =
        target === "centre"
          ? { x: spaceBox.x + spaceBox.width / 2, y: spaceBox.y + spaceBox.height * 0.25 }
          : { x: kayBox.x + kayBox.width / 2, y: kayBox.y + kayBox.height / 2 };
      const under = await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? "",
        point,
      );
      const from = await selectReply(page, 12);
      await carry(page, from, [point]);
      litBorders.push(
        await page
          .locator("[data-ground][data-lit]")
          .first()
          .evaluate((el) => getComputedStyle(el).borderTopColor)
          .catch(() => "none"),
      );
      await page.mouse.up();
      await lanes(page)
        .first()
        .waitFor({ timeout: 10_000 })
        .catch(() => {});
      drops.push({ target, under, lanes: await lanes(page).count() });
      await canvasIn(page)
        .getByRole("button", { name: /^Close / })
        .first()
        .click()
        .catch(() => {});
      await page.waitForTimeout(300);
    }
    const g7 = drops.every((d) => d.lanes === 1 && d.under !== "IMG");
    const g8 = litBorders.every((c) => c === olive);
    const transfer = await page.evaluate(
      () =>
        performance.getEntriesByType("resource").find((entry) => entry.name.includes("/splash/"))
          ?.transferSize ?? -1,
    );
    const g10 = transfer > 0 && transfer <= 30_000;
    await context.close();
    ok &&= g2 && g7 && g8 && g10;
    return {
      ok,
      detail: `${notes.join("; ")}; G2 ${afterCreate}→${afterClose}; G7 ${JSON.stringify(drops)}; G8 ${litBorders.join("/")} ${g8}; G10 ${transfer} bytes`,
    };
  },

  // Section 8: Kay.
  async H(browser) {
    const notes = [];
    let ok = true;
    const { page, context } = await openScenario(browser, {});
    await toEmpty(page);
    const kayBox = await kay(page).boundingBox();
    const space = await openSpace(page).boundingBox();
    const right = space.x + space.width - (kayBox.x + kayBox.width);
    const bottom = space.y + space.height - (kayBox.y + kayBox.height);
    const h1 =
      Math.abs(kayBox.width - 96) <= 2 && Math.abs(right - 24) <= 1 && Math.abs(bottom - 24) <= 1;
    notes.push(`H1 ${round(kayBox.width)}px, ${round(right)} right, ${round(bottom)} bottom ${h1}`);
    const alpha = await kay(page).evaluate((img) => {
      const canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
      const context2d = canvas.getContext("2d");
      context2d.drawImage(img, 0, 0);
      return context2d.getImageData(0, 0, 1, 1).data[3];
    });
    const size = await page.evaluate(
      () =>
        performance
          .getEntriesByType("resource")
          .find((entry) => entry.name.endsWith("/kay/kay.webp"))?.transferSize ?? -1,
    );
    const h6 = alpha === 0 && size > 0 && size <= 60_000;
    notes.push(`H6 corner alpha ${alpha}, ${size} bytes ${h6}`);
    const avatar = titleBar(page).getByRole("button", { name: "Account" }).locator("img");
    const h5 =
      (await avatar.getAttribute("src"))?.includes("kay-face") === true &&
      (await avatar.getAttribute("alt")) === "";
    notes.push(`H5 ${h5}`);
    ok &&= h1 && h5 && h6;
    await context.close();

    const overlaps = [];
    for (const viewport of WIDTHS) {
      const opened = await openScenario(browser, { viewport });
      await toEmpty(opened.page);
      const shownKay = await kay(opened.page).isVisible();
      const spaceBox = await openSpace(opened.page).boundingBox();
      if (shownKay) {
        const k = await kay(opened.page).boundingBox();
        for (const el of [
          openSpace(opened.page).locator("p"),
          openSpace(opened.page).getByRole("button"),
        ]) {
          const b = await el.boundingBox();
          const hit =
            k.x < b.x + b.width &&
            b.x < k.x + k.width &&
            k.y < b.y + b.height &&
            b.y < k.y + k.height;
          if (hit) overlaps.push(`${viewport.width} hits`);
        }
      } else if (spaceBox.width >= 480)
        overlaps.push(`${viewport.width} hidden at ${spaceBox.width}`);
      if (shownKay && spaceBox.width < 480)
        overlaps.push(`${viewport.width} shown at ${spaceBox.width}`);
      notes.push(`${viewport.width}: space ${round(spaceBox.width)} kay ${shownKay}`);
      await opened.context.close();
    }
    const h2 = overlaps.length === 0;
    const lanesOpen = await openScenario(browser, {});
    await toLanes(lanesOpen.page);
    const h3 = (await kay(lanesOpen.page).count()) === 0;
    await lanesOpen.context.close();
    ok &&= h2 && h3;
    return {
      ok,
      detail: `${notes.join("; ")}; H2 ${h2} ${overlaps.join(",")}; H3 ${h3}; H4 see G7`,
    };
  },

  // Section 9: dark mode. A to G loop over both themes; this adds I2 and I3.
  async I(browser) {
    const heads = [];
    for (const theme of THEMES) {
      const { page, context } = await openScenario(browser, { theme, query: query("solid") });
      await page.mouse.move(700, 600);
      heads.push(await shot(titleBar(page)));
      await context.close();
    }
    const probe = await openScenario(browser, { theme: "light" });
    // The window's rounded top corners show the desk, which is the page's and changes with it.
    const i2 = await samePixels(probe.page, heads[0], heads[1], 0, 12);
    const look = async () => ({
      paper: await tokenColour(probe.page, "--paper"),
      ink: await tokenColour(probe.page, "--ink"),
      bar: await titleBar(probe.page).evaluate((el) => getComputedStyle(el).backgroundColor),
    });
    const before = await look();
    await titleBar(probe.page).getByRole("button", { name: "Account" }).click();
    await probe.page.getByRole("menuitemradio", { name: "Dark" }).click();
    await probe.page.keyboard.press("Escape");
    await probe.page.waitForTimeout(200);
    const after = await look();
    const i3 = before.paper !== after.paper && before.ink !== after.ink && before.bar === after.bar;
    await probe.context.close();
    return {
      ok: i2.same && i3,
      detail: `I2 bar identical across themes ${i2.same} (${i2.differ} px differ); I3 ${JSON.stringify(before)} → ${JSON.stringify(after)} ${i3}`,
    };
  },

  // Section 10: reduced motion.
  async J(browser) {
    const notes = [];
    const reduce = await openScenario(browser, {});
    const barRunning = await running(reduce.page);
    await toEmpty(reduce.page);
    const emptyRunning = await running(reduce.page);
    await canvasIn(reduce.page).getByRole("button", { name: "Create blank thread" }).click();
    await lanes(reduce.page).first().waitFor();
    await canvasIn(reduce.page)
      .getByRole("button", { name: /^Close / })
      .first()
      .click();
    await reduce.page.waitForTimeout(100);
    const cycleRunning = await running(reduce.page);
    const one = await shot(canvasIn(reduce.page));
    await reduce.page.waitForTimeout(1000);
    const two = await shot(canvasIn(reduce.page));
    const j1 =
      barRunning.length === 0 &&
      emptyRunning.length === 0 &&
      cycleRunning.length === 0 &&
      Buffer.compare(one, two) === 0;
    const motion = await splash(reduce.page).evaluate((el) => {
      const style = getComputedStyle(el);
      return `${style.transitionDuration} ${style.animationName}`;
    });
    const kayMotion = await kay(reduce.page).evaluate(
      (el) => getComputedStyle(el).transitionDuration,
    );
    const j3 = motion === "0s none" && kayMotion === "0s";
    notes.push(
      `J1 ${barRunning}|${emptyRunning}|${cycleRunning} same ${Buffer.compare(one, two) === 0}; J3 ${motion} / ${kayMotion}`,
    );
    await reduce.context.close();
    const moving = await openScenario(browser, { motion: "no-preference" });
    await toEmpty(moving.page);
    await moving.page.waitForTimeout(1000);
    const j2 = (await running(moving.page)).length === 0;
    notes.push(`J2 ${j2}`);
    await moving.context.close();
    return { ok: j1 && j2 && j3, detail: notes.join("; ") };
  },

  // Section 12: the guards. K3 is web-check and the repo gates; K4 is tokens.test.ts.
  async K(browser) {
    const baseline = readBaseline();
    const notes = [];
    let ok = true;
    for (const theme of THEMES) {
      const base = baseline.json[theme];
      const { page, context } = await openScenario(browser, { theme, viewport: GROWN });
      const k1 = [
        (await titleBar(page).ariaSnapshot()) === base.bar.header,
        (await sidebar(page).ariaSnapshot()) === base.bar.sidebar,
      ];
      const k2 = await samePixels(
        page,
        await shot(shown(page)),
        baseline.png(`bar-tabpanel-${theme}`),
        TRIM,
      );
      await toEmpty(page);
      k1.push(
        (await titleBar(page).ariaSnapshot()) === base.empty.header,
        (await sidebar(page).ariaSnapshot()) === base.empty.sidebar,
        (await canvasIn(page).ariaSnapshot()) === base.empty.canvas,
      );
      await toLanes(page);
      k1.push(
        (await titleBar(page).ariaSnapshot()) === base.lanes.header,
        (await sidebar(page).ariaSnapshot()) === base.lanes.sidebar,
        (await canvasIn(page).ariaSnapshot()) === base.lanes.canvas,
      );
      ok &&= k1.every(Boolean) && k2.same;
      notes.push(
        `${theme}: K1 ${k1.join("/")}; K2 tab panel as baseline ${k2.same} (${k2.differ} px differ)`,
      );
      await context.close();
    }
    return { ok, detail: notes.join("; ") };
  },
};
