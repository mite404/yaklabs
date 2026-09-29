// Checks for the collapsed rail's places and the name pills they show, on a desktop window with
// motion on.
// oxlint-disable no-await-in-loop -- one pointer drives one page, so each step waits for the last
import { shotPath } from "./lever.mjs";
import { contrast, openDesk, peek, round } from "./sidebar-checks.mjs";

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

/** The workspace lever's checks of the rail's places, by id. */
export const railChecks = {
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
