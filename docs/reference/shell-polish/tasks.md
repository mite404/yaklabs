# Visual polish: canvas splash, title bar chrome, trim, and Kay the mascot

A task list for the engineer who takes this polish pass. Every area gives what the reference
shows, what the app does today, the change (tagged **[Asked]** when Ethan asked for it and
**[Suggested]** when it is the designer's own proposal), and acceptance predicates a Playwright
lever can measure. Open questions only Ethan can answer are collected in section 14; tasks that
depend on one say so.

Ethan's words, verbatim: "this is kind of what i had in mind. there's a splash screen before
anything is put onto the canvas. the title bar will still carry the tabs, but there will be a
color trim accent. i also played around with a kind of 'oil painting, w/ subtle green gradient
instead of a solid color for the title bar. i like what you have, i'm only showing these examples
as example style for canvas splash screen, title bar color schemes, keep the app shell inside the
browser window and the buffalo aka Yak AI's mascot, Kay."

Read that as: the mocks are a style reference for four things (the canvas splash, the title bar
colour, the trim, Kay the mascot), and everything else the app already does stays. The mocks leave
out the tabs, the sidebar toggle, the layout switch and the data marker. That is not a request
to remove them.

---

## 0. Before you start

### 0.1 The base

This branch, `claude/kay-shell-polish`, already holds the shell: the web integrator's work
(`180d1ac`) merged with the reviewed packages (`c974a27`). Polish what is here.

`claude/kind-sagan-a3mwjn` still points at the older `66ac54f` and has no shell. Another session
is finishing the shell and pushes there only when every gate is green. When
`origin/claude/kind-sagan-a3mwjn` moves, merge it into this branch (never rebase), and prefer its
side for anything outside the polish. Check at the start of each work unit.

### 0.2 Sources

| Id | File (under `docs/reference/shell-polish/`) | What it is |
| --- | --- | --- |
| R9 | `mocks/solid-title-bar-atlas-splash.png` 1522x817 | Solid dark green bar, Atlas line drawing splash, Kay bottom right, Kay avatar |
| R10 | `mocks/oil-painting-title-bar.webp` 1527x830 | Oil-painting bar (dark foliage), 2px coloured trim around the body |
| R11 | `mocks/oil-painting-canvas-wash.webp` 1552x789 | Oil-painting landscape wash behind the dotted canvas, same trim |
| R6 | `earlier/kay-desktop-app.jpg` | Kay's own desktop app: tabs in the bar, thread plus browser |
| R7 | `earlier/title-bar-area.webp` | The title bar area, marked up in red |
| R8 | `earlier/window-in-browser.png` 1189x119 | Window inside the browser; bell then avatar at far right; light bar |
| R3-5 | `earlier/conductor-project-*.png` | Conductor project rows (already built, ADR-093) |
| N-L | `as-built/demo-light.png` 1440x900 | The app as built, light |
| N-D | `as-built/demo-dark.png` | The app as built, dark |
| N-C | `as-built/collapsed.png` | Sidebar collapsed to the rail |
| N-H | `as-built/sidebar-hover.png` | Sidebar with a project row hovered |

Pixel values below were sampled from these files. Per ADR-051, a sampled colour is evidence of
what a mock looks like, never a brand fact. Every hex that ships comes from a declared token or
from a value Ethan names.

### 0.3 Rules that bind every task

- The accessible names in `docs/trail/evidence/projects-sidebar/contract.md` ("Accessible names
  the levers rely on") must not change. New hooks are additive `data-slot` attributes only.
- Tokens only. No raw hex in components (ADR-082's guard). Every new colour gets a token in
  `packages/catalog/src/tokens.css`, with its measured ratio written beside it (ADR-065, ADR-090).
- New UI is shadcn plus Tailwind on Kay's tokens (ADR-082). The splash's button stays the
  CSS-only `.btn` (it is on the do-not-convert list in `AGENTS.md`).
- Contrast: text 4.5:1, icons, rings, outlines and state indicators 3:1, measured on every surface
  the colour touches, including hover, pressed, focus and dark mode (ADR-065).
- Green is reserved for button hovers (ADR-055, ADR-058). A dark green title bar breaks that
  rule, so it needs a new ADR that amends both (see 13.1).
- Each decision gets an ADR entry in `docs/adr/adr.md`, and `docs/FOR_ETHAN.md` gets its update
  (AGENTS.md).

### 0.4 Fixed scenarios for the levers

All runs use Chromium, `deviceScaleFactor: 1`, and `reducedMotion: "reduce"` unless a predicate
says otherwise. Set the theme with an init script, `localStorage.setItem("theme", "light" |
"dark")`. Before a screenshot, wait for
`document.fonts.ready` and for `decode()` on every `img`.

- **SC-bar**: 1440x900, `/?scenario=demo`, wait until `[data-slot="data-marker"]` is visible
  and `[data-sidebar="menu-skeleton"]` has count 0. Subject: `header[data-slot="title-bar"]`.
- **SC-empty**: SC-bar, then click the sidebar link "Refund audit" (a main thread with no
  lanes), then `getByRole("group", { name: "Layout" }).getByRole("button", { name: "Canvas" })`.
  Subject: `[role="tabpanel"]:not([inert]) [aria-label="Compose canvas"]`.
- **SC-lanes**: SC-bar, then the tab "Last week's sales" in tablist "Open threads" (the profit
  main, on canvas, with lanes). Same subject as SC-empty.
- **SC-long**: `/?scenario=long` (12 tabs, 12 notifications, a "9+" badge).
- **SC-loading**: `/?scenario=loading` (the skeleton tab).
- **Widths**: 1440x900, 1280x800, 767x900 (full-bleed), 390x844.

### 0.5 Measurements the predicates use

- **ratio(a, b)**: the WCAG 2.x contrast ratio of two sRGB colours.
- **worst(el, fg)**: take an element screenshot of `el`'s box with only the foreground node
  hidden (inject `visibility: hidden` on it). Return the minimum `ratio(fg, pixel)` over every
  pixel in the box. For an icon, `fg` is its computed `color`. This is the number that matters
  on the painting, where the background varies pixel by pixel.
- **shot(el)**: `locator.screenshot({ animations: "disabled", caret: "hide" })` under the
  scenario above.
- **running()**: `document.getAnimations().filter(a => a.timeline instanceof DocumentTimeline &&
  a.playState === "running")`. Scroll-driven animations (the tab strip's `tab-fade`) are excluded
  on purpose.
- **aria(el)**: `locator.ariaSnapshot()`.

### 0.6 Baseline first

On the base commit, before any change, save these to `.artifacts/polish/baseline/`:

- `aria(header[data-slot="title-bar"])`, `aria([data-slot="sidebar"])` and
  `aria(Compose canvas)` in SC-bar, SC-empty and SC-lanes.
- `shot()` of the SC-empty and SC-lanes canvas regions, and of `[role="tabpanel"]:not([inert])`
  in SC-bar, in light and dark.
- The bounding boxes of `[role="tabpanel"]:not([inert])`, `[data-slot="sidebar"]` and every tab.

Every "equals baseline" predicate below compares against these files. The nav set has no
empty-canvas shot, so B-empty has to be captured here.

---

## 1. The title bar colour (solid variant)

**Reference.** R9: the bar runs y=17 to 66 (50px), flat `#3b423c` within one level (sampled at
x=800, every row). Only the traffic lights and, far right, the bell and a Kay avatar sit on it.
R8, the earlier reference, had a light bar (`#f0efea` at 300,30).

**Today.** N-L: the bar is the app's paper (`bg-paper`, `#f0efea`), 44px (`h-11` in
`apps/web/src/shell/title-bar.tsx`). The active tab is `#ffffff` (at 500,30). N-D: the bar is
dark paper.

**Change.**

- [Asked] Fill the bar with a dark green chrome colour, a new token `--chrome`. Interim value:
  `#3b423c` from R9, flagged in `tokens.css` as "Ethan's mock, sampled; confirm the hex" until
  Ethan names it (Q3).
- [Suggested] Add a `.chrome-surface` class in `tokens.css` that remaps the role tokens, the way
  `.attention-surface` does (tokens.css lines 275 to 280). Then every shadcn primitive inside the
  bar comes out right with no per-component overrides. Measured on `#3b423c`:

| Role inside the bar | Value | Ratio on the bar |
| --- | --- | --- |
| `--ink` | cream `#f0efea` | 8.98:1 |
| `--soft-ink` | cream at 72%, `#bdbfb9` | 5.57:1 |
| `--paper-deep` (hover fill) | cream at 8%, `#49504a` | cream on it 7.21:1 |
| `--hairline` | cream at 18% | line only |
| `--focus`, shadcn `--ring` | cream | 8.98:1 (today's `#8a8a85` is 2.98:1 and fails) |
| `--on-ink` (text on an ink fill) | `--yak-night` | 16.1:1 on cream |

- [Suggested] Keep the bar 44px. R9 is 50px and R10 is 47px plus the trim, so the mocks
  disagree, and the contract does not fix a height (Q9).

**Acceptance.**

- A1: In SC-bar, the computed `background-color` of `header[data-slot="title-bar"]` equals the
  resolved `--chrome` (for the interim value, `rgb(59, 66, 60)`).
- A2: The header's box height is exactly 44 at every width in 0.4.
- A3: For every text node in the header, `ratio(color, --chrome)` is at least 4.5. For every
  `svg`, it is at least 3.0.
- A4: `rg -n '#[0-9a-fA-F]{3,8}\b' apps/web/src/shell` matches nothing (tokens only).
- A5: `aria(header)` is byte-identical to the baseline in SC-bar, SC-long and SC-loading.

## 2. The oil-painting variant of the bar

**Reference.** R10: the bar (y=31 to 77) is a desaturated green-grey painting with dark foliage
at top left and top right. Over x=100 to 1430 and y=36 to 77, the darkest pixel is `#464b47` and
the lightest `#7b7f77`. Cream on that lightest pixel is 3.55:1, which fails text. Ethan: "'oil
painting, w/ subtle green gradient instead of a solid color".

**Today.** Nothing like it.

**Change.**

- [Asked, as an exploration] Add a painting variant behind `[data-slot="window"]
  [data-chrome="painting"]`, with `solid` as the other value. Which one is the default is Q2.
  The bar background is a green gradient over the painting, and the painting is tinted and
  darkened so that every pixel under text has relative luminance of 0.1527 or less (cream 4.5:1),
  and every pixel under an icon 0.254 or less (3:1).
- [Suggested] Set `background-color` to the painting's mean colour. Then a slow or blocked
  image still gives a passing bar and no flash. The asset is AVIF or WebP at 2x (2880x88), and
  its source and licence are recorded in `apps/web/public/chrome/CREDITS.md` (Q4).
- [Suggested] Make the variant switchable for levers and for Ethan's review: a `?chrome=` query
  that app-built links keep, as they keep `?scenario=`, plus a stored preference (Q2).

**Acceptance** (SC-bar with `?chrome=painting`, at 1440 and 1280, and SC-long scrolled to the last
tab):

- B1: `worst()` is at least 4.5 for every tab label and the data marker's text, and at least 3.0
  for every icon, including the "+", each close button on hover, the bell and the badge fill.
- B2: The painting's `PerformanceResourceTiming.transferSize` is at most 80,000 bytes, and the
  header height is 44 both before and after the image's `load`.
- B3: With the image request aborted (`page.route(..., r => r.abort())`), B1 still passes.
- B4: `shot(header)` is byte-identical across two fresh loads (no random offset).
- B5: `apps/web/public/chrome/CREDITS.md` exists and names the painting, its source URL and its
  licence.

## 3. The trim accent

**Reference.** R10: a 2px line around the body below the bar, at x=12 to 14 on the left, x=1504
to 1506 on the right, y=78 to 80 on top (directly under the bar) and y=812 to 814 at the bottom.
Its core samples at about `#2b85c0` (`#2985c6` to `#3385be` with compression noise). R11 has the
same frame (x=14 to 15 and 1526 to 1527, y=21 to 22). R9 has no trim.

Three things to weigh:

- The blue matches no Kay token. The nearest declared blue is `--blue: #95aac8`, which is text
  selection.
- A 2px blue ring around the whole content reads as a keyboard focus ring (ADR-053).
- It sits exactly where Figma draws a selected frame's outline, so part of it may be a Figma
  artefact (Q5).

**Today.** The window has a 1px hairline border and a 10% shadow (`window.tsx`). The inset
content has a hairline top and left edge with a 10px top-left corner.

**Change.**

- [Asked] Add a `--trim` token and draw the trim where Ethan chooses: around the body, as in
  R10, or as one line under the bar (Q6). Its colour is Q7.
- [Suggested] Draw it so it takes no layout space (an inset box-shadow or a pseudo-element on a
  new `[data-slot="window-body"]`). Then no box below the bar moves and every existing screenshot
  stays valid.
- [Suggested] Until Ethan picks a colour, set `--trim: var(--olive)`. Candidates, measured:

| Candidate | Against the body `#f8f8f6` | Against the bar `#3b423c` | Already means |
| --- | --- | --- | --- |
| `--olive` `#515e38` | 6.57:1 | 1.48:1 | links, the slider accent |
| sampled blue `#2b85c0` | 3.78:1 | 2.57:1 | nothing (undeclared; reads as focus) |
| `--blue` `#95aac8` | 2.23:1 | n/a | text selection |
| `--yak-orange` `#d19456` | n/a | 3.98:1 | "Needs attention" only (ADR-068) |
| `--sage` `#c7cfba` | n/a | 6.43:1 | the user's bubble only (ADR-047) |

**Acceptance.**

- C1: The trim element's computed width is 2px and its colour equals the resolved `--trim`, at
  the placement Ethan picks.
- C2: `ratio(--trim, side)` is at least 3.0 against at least one of the two surfaces the trim
  separates.
- C3: The trim is not a focus indicator. Its computed colour is identical with focus in the
  compose box and with focus on `body`, and it differs from the resolved `--focus` and `--ring`.
- C4: The boxes of `[role="tabpanel"]:not([inert])`, `[data-slot="sidebar"]` and every tab equal
  the baseline to the pixel (the trim takes no layout).
- C5: At 767x900 (full-bleed) the trim is still drawn, and `[data-slot="window-body"]` is as
  wide as the viewport.

## 4. The tabs on a dark bar

**Reference.** R9 and R10 show no tabs, but Ethan says "the title bar will still carry the tabs".
R6 (Kay's app) has pill tabs in the bar, with the active one lighter.

**Today.** N-L: each tab is 220px and 30px tall. Inactive tabs are filled `--paper-deep`
(`#e4e4df`) with soft-ink text; the active one is `--control-bg` white with a hairline border. A
close button shows on hover and on the active tab, and "+" (New thread) follows the tabs
(`tab-strip.tsx`). On a dark bar, these light blocks would be the loudest thing in the window.

**Change.**

- [Asked] The tabs stay in the bar, with the same names, order, widths, overflow scroll and
  edge fade.
- [Suggested] Inactive tabs are transparent, with `--soft-ink` text (cream 72%, 5.57:1).
- [Suggested] On hover a tab fills with `--paper-deep` (cream 8%) and its text turns full cream
  (7.21:1). Cream-72 text on that fill would be 4.47:1 and fail, so the text has to switch.
- [Suggested] The active tab is a paper pill: `--paper` in the page theme with `--ink` text.
  That is 8.98:1 against the bar in light mode, a clear 3:1 state indicator, and it echoes R6's
  lighter active tab. Dark mode needs its own check (section 9). The layout switch's pressed item
  uses the same paper pill, so "selected" looks the same everywhere in the bar.
- [Suggested] The close button and "+" use the same inks. The skeleton tab (SC-loading) uses
  `--paper-deep` from the remap.

**Acceptance** (SC-bar and SC-long, light and dark, both bar variants):

- D1: `worst()` of every tab label, at rest, hovered and active, is at least 4.5.
- D2: The active tab's state is visible. `ratio(active fill, bar)` is at least 3.0, or the active
  tab has a border or indicator whose ratio against the bar is at least 3.0.
- D3: Every tab box equals the baseline (220px wide at 1440 with the demo's tabs).
- D4: In SC-long, `.tab-scroller` still has a non-`none` `mask-image`, and the pixel 2px inside
  the faded right edge matches the bar colour within 2 levels per channel (the fade shows the bar,
  not paper).
- D5: In SC-loading, `ratio(skeleton fill, bar)` is at least 1.2, so the placeholder is visible.
- D6: Pressing Delete on a focused tab still closes it, and a middle click still closes any tab
  (behaviour unchanged).

## 5. The bell, the account and the rest of the bar's controls

**Reference.**

- R9: at far right, an outline bell (brightest pixel `#aeb4ba`, 4.94:1 on the bar, box about
  x=1458 to 1471, y=34 to 49), then a round avatar of Kay's face with a light ring, in the corner.
- R8: bell, then avatar (`#4a5568`), on a light bar.
- Neither mock has the data marker, the layout switch or the sidebar toggle.

**Today.** N-L, left to right on the right-hand side: the "Mock: demo" badge, the Layout group,
the bell with an ink badge "2", and a `UserRound` avatar. All are ink or soft-ink on paper. On the
dark bar, the badge's `bg-ink` would be 1.48:1 and disappear. The traffic lights carry a hairline
ring that would vanish too.

**Change.**

- [Asked] Bell, then avatar in the corner, as ADR-094 already has it.
- [Suggested] Everything else stays and takes the chrome remap:
  - Icons are `--ink`, and the toggle, "+" and marker text are `--soft-ink`.
  - The badge is a cream fill with `--on-ink` (night) text: 8.98:1 against the bar and 16.1:1
    for the text.
  - The Layout group gets a cream-18% border and the paper pill for the pressed item.
  - The traffic lights drop their ring (the OS colours are unchanged).
- [Suggested] Menus and tooltips render in portals, outside the header, so they keep the page
  theme. The remap must not leak into them.
- [Suggested] The avatar shows Kay's face only for the local build (no sign-in). A signed-in
  WorkOS user keeps their own picture or initials, because ADR-094 gives the corner to the account
  (Q8).

**Acceptance.**

- E1: A3 holds for the whole right-hand group, and B1 holds for it in the painting variant.
- E2: `ratio(badge fill, bar)` is at least 3.0 and `ratio(badge text, badge fill)` at least 4.5,
  with "2" in SC-bar and "9+" in SC-long.
- E3: Press Tab until "Toggle sidebar", "Notifications" and "Account" each take focus. The ring
  colour composited over the bar has at least 3.0 against the bar, measured with `worst()` on a
  box 4px larger than the control.
- E4: With the Notifications menu open, the computed `background-color` of `[role="menu"]` equals
  the page's resolved `--compose-bg` (`rgb(248, 248, 246)` light, `rgb(34, 39, 34)` dark). Its
  items' text is the page `--ink`, not cream.
- E5: The bell box's right edge is left of the Account box's left edge, and the Account box's
  right edge is within 12px of the header's right edge.
- E6: In the Layout group, the pressed item (`aria-pressed="true"`) has a fill whose ratio against
  the bar is at least 3.0.
- E7: The computed `border-color` of each traffic light is transparent or the chrome hairline,
  and their fills still equal `--traffic-close`, `--traffic-minimise` and `--traffic-zoom`.

## 6. The window inside the browser

**Reference.**

- R9: the window spans x=16 to 1514 of 1522 and y=17 to about 803 of 817, so the margin is about
  15px. The corners are rounded, and the ground is a cool grey `#ced2d4` (1.42:1 against the
  window body `#f7f7f5`).
- R8 and R10 have similar grounds (`#b3b4b3`, `#d0d2d6`). The "App Shell" label at R9 (16,0) is
  Figma's frame name, not app content.

**Today.** N-L: `[data-slot="window"]` is inset 8px (`md:inset-2`) with 12px corners, and it is
full-bleed below 768px, as the contract says. The ground (`#f7f7f5` at 3,3) against the bar
(`#f0efea`) is 1.07:1, so only the hairline and a 10% shadow show the window's edge. N-D: 1.11:1.
With a dark bar the top edge separates by itself, but the sides and bottom still do not.

**Change.**

- [Asked] Keep the app as a window inside the browser.
- [Suggested] Give the ground its own token, `--desk`, a warm grey from the palette rather than
  the mock's cool grey (ADR-051). `#d6d5cf` (the attention grey) is 1.37:1 against `#f7f7f5`;
  `#cbcac4` is 1.53:1. Ethan picks (Q10).
- [Suggested] A 16px inset at 768px and wider, matching R9. The contract says 8px, so this amends
  the contract's Frame line. Ethan decides (Q10).

**Acceptance.**

- F1: At 1440x900 and 1280x800, the box of `[data-slot="window"]` equals the viewport inset by
  the chosen margin on every side. At 767x900 it equals the viewport.
- F2: The computed `border-radius` is 12px at 768px and wider, and 0 below.
- F3: `ratio(ground pixel at (3,3), window body pixel)` is at least 1.3, and `ratio(ground, bar)`
  at least 1.5, in light and dark.
- F4: The pixel 1px inside the window's top-left and top-right corners, outside the curve, equals
  the ground. The bar's fill or painting does not bleed past the radius.
- F5: The document never scrolls: `scrollingElement.scrollWidth === innerWidth` and
  `scrollHeight === innerHeight` at every width in 0.4.

## 7. The canvas splash

**Reference.**

- R9, canvas pane from x=552: the dotted field holds an open-space box with a fine dotted, rounded
  outline from about (562,78) to (1505,795). The two-line serif copy is centred at about (948 to
  1118, 404 to 436), and its darkest pixel is `#858581`: 3.42:1 on `#f6f6f3`, which fails. The
  "Create blank thread" button sits below it (about 985 to 1080, 449 to 467).
- Behind them is a faint line drawing of Atlas holding a sphere, spanning about (850 to 1230, 210
  to 795), with strokes near `#e9e9e8` (1.12:1 on the ground). A faint rounded rectangle whose
  top-left corner is near (770,165) is the drawing image's own bounds showing through, an
  artefact.
- R10 is the same splash.
- R11: the whole open space is an oil-painting landscape wash with the dots over it. Its pixels
  run from `#2a3327` to `#c2c5c0`, and ink text on the darkest is 1.17:1.
- "there's a splash screen before anything is put onto the canvas."

**Today.** `OpenSpace` in `apps/web/src/components/canvas.tsx` is a dashed hairline box
(`--radius-card`, 14px), serif `text-xl` copy in `--ink` (14.2:1), and the `.btn btn-sm` button.
The field is `.canvas` in `apps/web/src/index.css`, hairline dots on an 18px grid. There is no
splash. The nav set has no empty-canvas shot; B-empty from 0.6 is the "today" record.

**Change.**

- [Asked] Show a splash only while the canvas has no lanes: the line drawing behind today's copy
  and button, with Kay at bottom right (section 8). It leaves when the first lane lands and comes
  back when the last lane closes. The slim open-space column beside existing lanes is unchanged.
- [Asked, variant] R11's painting wash is a second splash style. Which one ships is Q2b.
- [Suggested] Keep today's copy colour (`--ink`), not the mock's 3.42:1 grey. Keep the copy
  text, button and drop behaviour exactly as they are.
- [Suggested] Draw the drawing as a CSS `mask-image` (SVG preferred) filled with a new
  `--splash-line` token. It themes for free, has no visible bounds, and needs no second asset for
  dark mode. The stacking order, bottom to top: dotted field, drawing, the carry's lit fill, copy
  and button, Kay. The drawing and Kay are `aria-hidden` with `pointer-events: none`.
- [Suggested] Hooks: `[data-slot="canvas-splash"]` and `[data-slot="splash-drawing"]`.
- [Suggested] If R11's wash ships, the copy and button sit on a paper plate. Without one, the
  text fails (1.17:1).

**Acceptance.**

- G1: In SC-empty, `[data-slot="canvas-splash"]` has count 1 in the active tabpanel. In SC-lanes
  it has count 0.
- G2: In SC-empty, click "Create blank thread". Once the lane appears, the splash count is 0.
  Click that lane's "Close <title>", and the count is 1 again.
- G3: `aria(Compose canvas)` in SC-empty and SC-lanes is byte-identical to the baseline. The
  drawing and Kay add nothing to the tree.
- G4: `worst()` of each copy line is at least 4.5 and of the button label at least 4.5. `worst()`
  of the button's border is at least 3.0. All of these in light and dark, for whichever splash
  styles ship.
- G5: In a 100x100 region of the drawing clear of the copy, the ratio of the darkest drawing
  pixel to the field is between 1.05 and 1.6, in light and dark. That is visible, but it never
  competes with the text.
- G6: The pixels 2px inside each corner of the drawing's box equal B-empty at the same
  coordinates. Only strokes differ from the field, so no bounds show.
- G7: Carry a highlight (as `apps/web/scripts/web-check.mjs` does) and drop it once on the
  splash's centre and once on Kay's centre. Each drop adds a lane, and
  `elementFromPoint(Kay's centre)` is never Kay's `img`.
- G8: During that carry, `[data-ground][data-lit]` exists and its border colour equals the
  resolved `--olive`, as today.
- G9: `shot()` of the SC-lanes canvas region is byte-identical to the baseline, in light and
  dark.
- G10: The drawing asset is at most 30 KB transferred.

## 8. Kay the mascot, and where he appears

**Reference.**

- R9: Kay, a shaggy brown yak rendered in 3D, stands at the canvas's bottom right. His bounding
  box is (1360,659) to (1456,769), 97x111px, about 49px in from the canvas's right edge and 34px
  up from the window's bottom.
- R10: the same place. R11: absent.
- R9 and R10: Kay's face is also the round avatar in the title bar's corner.
- Ethan: "the buffalo aka Yak AI's mascot, Kay".

**Today.** No mascot anywhere. The avatar is a `UserRound` icon (local build) or the WorkOS user's
picture or initials (`apps/web/src/shell/account.tsx`). The rail shows the Kay mark polygon
(ADR-095).

**Change.**

- [Asked] Kay appears in the canvas splash, at bottom right.
- [Asked] Kay's face appears as the avatar, scoped by Q8 (the suggestion is the local build
  only).
- [Suggested] Kay is part of the splash, not the canvas, so he leaves when the first lane lands.
  A mascot standing over lanes would cover them.
- [Suggested] `[data-slot="kay-mascot"]`, an `img` with `alt=""` and `aria-hidden`, `pointer-events:
  none`, 96px wide at 1440, inset 24px from the open space's right and bottom edges.
- [Suggested] Hide him when the open space is narrower than 480px, so he never crowds the copy.
- [Suggested] The asset is a transparent AVIF or WebP at 2x. It comes from Kay's or YakLabs'
  published files, not from a crop of Ethan's mock, which follows ADR-095's rule for the mark
  (Q11).
- [Suggested] No idle animation. See section 10.

**Acceptance.**

- H1: In SC-empty at 1440x900, the Kay box is 96px wide (within 2px), and its right and bottom
  edges are 24px inside the open space's box (within 1px).
- H2: The Kay box does not intersect the copy's or the button's box at any width in 0.4 where
  Kay is shown. Where the open space is narrower than 480px, Kay has count 0 or
  `display: none`.
- H3: In SC-lanes, `[data-slot="kay-mascot"]` has count 0.
- H4: G7 holds: Kay never intercepts a drop, a pan or a click.
- H5: In the local build, the Account avatar's image is Kay's face and its `alt` is `""`. The
  button's accessible name stays "Account" (A5). In a WorkOS build, the avatar is the user's.
- H6: The mascot asset is at most 60 KB transferred and has an alpha channel. The pixel at its
  box's corner equals the underlying field.

## 9. Dark mode

**Reference.** No dark mock. R9 and R10 are light.

**Today.** N-D: the bar, sidebar and body are dark paper `#1a1e1a` on night `#101310`
(ADR-090). The ground and window separate at 1.11:1.

**Change.**

- [Suggested] Keep `--chrome` the same in both modes, as the OS traffic lights are. The bar is
  window chrome, not content. `#3b423c` against dark paper is 1.63:1 and against night 1.79:1, so
  it stays visibly distinct from the body. The remap's cream inks are identical in both modes.
- [Suggested] The active tab's paper pill uses the dark `--paper` in dark mode (`#1a1e1a`),
  which is only 1.63:1 against the bar. It needs a cream-18% border to clear D2, or a dark-mode
  `--chrome` darker than the paper (Q12).
- [Suggested] `--splash-line` is ink at low alpha in light and cream at low alpha in dark. Kay
  is unchanged. `--trim` gets a dark value measured against dark paper.

**Acceptance.**

- I1: A1 to A3, B1, C2, D1 to D2, E1 to E6, F3 and G4 to G5 all hold with `theme: "dark"`.
- I2: For the solid variant, if `--chrome` is theme-independent, `shot(header)` with no tab
  hovered or focused is byte-identical between light and dark, except the active tab's box. (This
  proves the remap does not read page tokens it should not.)
- I3: The theme toggle in the Account menu still switches the page, the paper and the ink (the
  ADR-090 lever), and the bar's colour does not change.

## 10. Reduced motion

**Reference.** The mocks are still images.

**Today.** Skeletons stop under reduced motion (`index.css`), and the tab fade is scroll-driven.
The open space's lit state is a colour transition.

**Change.**

- [Suggested] The splash appears and leaves with at most a 150ms opacity fade, and none under
  reduced motion.
- [Suggested] No infinite animation anywhere in the polish: no idle Kay, no drifting painting,
  no parallax. Stable screenshots depend on it (ADR-101, ADR-087).

**Acceptance.**

- J1: With `reducedMotion: "reduce"`, `running()` is empty in SC-empty and SC-bar after
  `load`, and after creating and closing a lane (G2). Two `shot()`s of SC-empty taken 1s apart
  are byte-identical.
- J2: With `reducedMotion: "no-preference"`, `running()` is empty 1s after `load` in SC-empty
  and SC-bar (nothing loops).
- J3: With `reducedMotion: "reduce"`, the splash and Kay have a computed `transition-duration`
  of `0s`.

## 11. Where the references and the build disagree

| # | Reference shows | Build today | Resolution |
| --- | --- | --- | --- |
| 1 | Serif "K" as the rail mark (R9 33,86; R10) | Kay's declared polygon (ADR-095) | Keep the build |
| 2 | No tabs, toggle, "+", layout switch or marker in the bar | All present; the contract names them | Keep; restyle (sections 4 and 5) |
| 3 | Splash copy `#858581`, 3.42:1 | `--ink`, 14.2:1 | Keep the build (G4) |
| 4 | The drawing's image bounds show (R9 near 770,165) | n/a | Mask; no bounds (G6) |
| 5 | A blue 2px trim that reads as a focus ring | Hairline border | Token, not a focus look (C3; Q5 to Q7) |
| 6 | A cool grey ground `#ced2d4` | Ground 1.07:1 against the bar | Warm `--desk` (F3; Q10) |
| 7 | Painting under the bar's icons at 3.55:1 (R10) | n/a | Darken until B1 passes |
| 8 | Painting under the canvas copy at 1.17:1 (R11) | n/a | Paper plate (G4) |
| 9 | Bar 50px (R9) or 47px (R10) | 44px | Keep 44 (A2; Q9) |
| 10 | Bell with no badge | Badge with unread count | Keep the badge; restyle (E2) |
| 11 | Kay's face as the account avatar | The account's own face | Local build only (H5; Q8) |
| 12 | Window margin about 15px | 8px (contract) | 16px if Ethan agrees (F1; Q10) |

## 12. Guards for every task

- K1: `aria()` of the header, the sidebar and the Compose canvas, in SC-bar, SC-empty, SC-lanes,
  SC-long and SC-loading, is byte-identical to the baseline.
- K2: `shot()` of `[role="tabpanel"]:not([inert])` in SC-bar (the browser layout) is
  byte-identical to the baseline, in light and dark. The polish touches only the chrome and the
  empty canvas.
- K3: `node apps/web/scripts/web-check.mjs` passes with no console errors. The repo gates pass:
  typecheck, tests, lint, the Storybook story tests and the raw-colour guard.
- K4: Every new token in `tokens.css` has its ratio written beside it (ADR-090's convention),
  and a unit test asserts each ratio from the token values, so a later edit that breaks one fails
  the build.

## 13. Suggested order of work

1. Baselines captured (0.6).
2. The `--chrome` token and the `.chrome-surface` remap, with the solid bar (section 1), plus the
   ADR that amends ADR-055 and ADR-058: green now also marks the window chrome.
3. Tabs, then the right-hand group, on the dark bar (sections 4 and 5).
4. The window ground and inset (section 6).
5. The trim (section 3), after Q5 to Q7.
6. The splash with the drawing (section 7), then Kay (section 8).
7. The painting variants (sections 2 and 7), after Q2 and Q4.
8. The dark mode and reduced-motion passes (sections 9 and 10), the ADRs, and `docs/FOR_ETHAN.md`.

### 13.1 What Ethan asked for, and what is the designer's suggestion

Asked:

- A splash on the empty canvas.
- A green title bar, solid or as an oil painting with a subtle green gradient.
- A colour trim accent.
- Tabs kept in the bar.
- The app kept inside the browser window.
- Kay, the mascot, in the splash and as the avatar.

Suggested:

- The `.chrome-surface` token remap, and the specific tab, badge, focus and pressed styles.
- Keeping `--chrome` identical across themes.
- The trim taking no layout, and the olive interim trim.
- `--desk` and the 16px inset.
- Kay scoped to the splash, and the avatar only for the local build.
- The mask-drawn drawing.
- The asset budgets, the no-loop motion rule, and every predicate above.

## 14. Open questions only Ethan can answer

- Q2: The bar variant: solid (R9) or painting (R10) by default? Should the other one stay as a
  switch?
- Q2b: The splash style: the Atlas line drawing (R9 and R10), the painting wash (R11), or both,
  one per bar variant?
- Q3: The bar's exact hex. `#3b423c` is sampled from R9. Is there a Figma value, or should it
  come from the declared palette (for example a mix of `--moss #263b30` and `--yak-night`)?
- Q4: Source files and licences for the painting(s), and the gradient's stops. Which painting,
  from where, under what licence?
- Q5: Is the blue frame in R10 and R11 the trim, or Figma's selection outline?
- Q6: Does the trim run around the whole body (R10), or only as a line under the bar?
- Q7: The trim's colour. The candidates are in section 3. Blue is undeclared and reads as focus,
  orange and sage already mean something, and olive is the neutral pick.
- Q8: Is Kay's face the avatar for everyone, only when signed out or in the local build, or is
  it Kay's own presence (the agent) rather than the account's?
- Q9: The bar's height: keep 44px, or 50px as in R9?
- Q10: The ground colour outside the window, and the margin: 8px (contract) or about 16px (R9)?
- Q11: Kay's source file. A transparent PNG or WebP (or a layered original) from Kay's or YakLabs'
  published assets, and permission to ship it. Same question for the Atlas drawing: its source,
  its licence, and a vector if one exists.
- Q12: In dark mode, should the bar keep the same green, or go darker than the dark paper?
- Q13: Should Kay ever appear outside the empty canvas, for example in "Nothing open" or the
  `empty` scenario?
