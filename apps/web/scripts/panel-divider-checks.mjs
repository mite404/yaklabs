// Checks the line that parts the rail from the projects panel (ADR-139), on a desktop window:
// docked by the toggle, closed and peeking, in both themes.
import { openDesk, peek } from "./sidebar-checks.mjs";

// Runs in the page: the line at the panel's left edge, as its inner box's shadow, and the
// hairline token it should draw in.
function dividerNow() {
  const inner = document.querySelector('[data-slot="sidebar-inner"]');
  const probe = document.createElement("div");
  probe.style.color = "var(--hairline)";
  document.body.append(probe);
  const hairline = getComputedStyle(probe).color;
  probe.remove();
  return { shadow: getComputedStyle(inner).boxShadow, hairline };
}

// P35 in one theme: the divider docked, closed and while peeking.
async function dividerIn(browser, theme) {
  const docked = await openDesk(browser, { side: "open", theme });
  const onDock = await docked.page.evaluate(dividerNow);
  await docked.context.close();
  const closed = await openDesk(browser, { theme });
  const onClose = await closed.page.evaluate(dividerNow);
  await peek(closed.page);
  const onPeek = await closed.page.evaluate(dividerNow);
  await closed.context.close();
  const ok =
    onDock.shadow === `${onDock.hairline} 1px 0px 0px 0px inset` &&
    onClose.shadow === "none" &&
    onPeek.shadow === "none";
  return {
    ok,
    note: `${theme}: docked ${onDock.shadow} (hairline ${onDock.hairline}), closed ${onClose.shadow}, peeking ${onPeek.shadow}`,
  };
}

/** The workspace lever's checks of the panel's divider, by id; panel-checks.mjs registers them. */
export const panelDividerChecks = {
  // Docked by the toggle, a hint of a line parts the rail from the panel, the workspace's own
  // hairline at the panel's left edge, as in Kay's app (Ethan); closed or peeking, none.
  async P35(browser) {
    const results = [await dividerIn(browser, "light"), await dividerIn(browser, "dark")];
    return { ok: results.every((r) => r.ok), detail: results.map((r) => r.note).join("; ") };
  },
};
