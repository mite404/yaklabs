// The rail's places as the browser levers expect them, and how a lever finds and reads them.
// Kept apart from the levers' harness, so a script that only needs the list starts no browser
// and makes no output folder.

/**
 * The rail's places top to bottom (ADR-094, amended): each one's name, its role, the lucide
 * glyph it draws (Kay draws its own mark), and whether the web build lacks it yet.
 */
export const RAIL_PLACES = [
  { name: "Kay", role: "link", icon: null, soon: false },
  { name: "Memory", role: "button", icon: "lucide-brain", soon: true },
  { name: "Skills", role: "button", icon: "lucide-unplug", soon: true },
  { name: "App store", role: "button", icon: "lucide-store", soon: true },
  { name: "Analytics", role: "button", icon: "lucide-chart-column-increasing", soon: true },
  { name: "Automations", role: "button", icon: "lucide-clock", soon: true },
  { name: "Documentation", role: "link", icon: "lucide-book-open", soon: false },
  { name: "Lab", role: "link", icon: "lucide-flask-conical", soon: false },
];

/**
 * Runs in the page: each place in a sidebar header, top to bottom, as its accessible name, its
 * role, its first glyph's lucide class, the glyph's box, and its unavailable state.
 */
export function readPlaces(header) {
  return [...header.querySelectorAll('[data-sidebar="menu-button"]')].map((el) => {
    const glyph = el.querySelector("svg");
    const box = glyph.getBoundingClientRect();
    const described = el.getAttribute("aria-describedby");
    return {
      name: el.getAttribute("aria-label") ?? el.textContent.trim(),
      role: el.tagName === "A" ? "link" : el.tagName.toLowerCase(),
      icon: /lucide-[\w-]+/.exec(glyph.getAttribute("class"))?.[0] ?? null,
      glyph: [box.x, box.y, box.width, box.height],
      disabled: el.getAttribute("aria-disabled"),
      href: el.getAttribute("href"),
      description:
        described === null ? null : document.querySelector(`[id="${described}"]`).textContent,
    };
  });
}

/** A rail place in the sidebar of a Playwright page, by its role and name. */
export const placeOf = (page, { role, name }) =>
  page.locator('[data-slot="sidebar"]').getByRole(role, { name, exact: true });

/**
 * Runs in the page: each place not built yet in a sidebar header, as its name's edges and
 * whether it shows whole, its short hint's words, edges and visibility, the button's edges, and
 * the inks of the name and the hint with the shell behind them.
 */
export function readSoonRows(header) {
  const shell = getComputedStyle(document.querySelector('[data-slot="sidebar-inner"]'));
  return [...header.querySelectorAll('[aria-disabled="true"]')].map((el) => {
    const spans = [...el.querySelectorAll("span")];
    const [label] = spans;
    const tag = spans.find((span) => span.getAttribute("aria-hidden") === "true");
    const [labelBox, tagBox, buttonBox] = [label, tag, el].map((each) =>
      each.getBoundingClientRect(),
    );
    return {
      name: label.textContent,
      label: { left: labelBox.left, right: labelBox.right },
      whole: label.scrollWidth <= label.clientWidth,
      tag: tag.textContent,
      shown: tag.checkVisibility(),
      tagBox: { left: tagBox.left, right: tagBox.right },
      button: { left: buttonBox.left, right: buttonBox.right },
      labelInk: getComputedStyle(label).color,
      tagInk: getComputedStyle(tag).color,
      shell: shell.backgroundColor,
    };
  });
}
