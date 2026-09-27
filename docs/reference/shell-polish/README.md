# Shell polish: the canvas splash, the title bar, the window and Kay

This is the handoff brief for the visual polish of the app shell. The branch
`claude/kay-shell-polish` starts from the shell as it was built on `claude/kind-sagan-a3mwjn`'s
work in progress. It has three parts:

- the local integration branch: the runtime, the carry and the shadcn sidebar, with 40 review
  fixes
- the web integration: the window, the title bar with tabs, the project sidebar and the canvas
- the reference images in this folder

## What Ethan asked for, in his words

> this is kind of what i had in mind. there's a splash screen before anything is put onto the
> canvas. the title bar will still carry the tabs, but there will be a color trim accent. i also
> played around with a kind of 'oil painting, w/ subtle green gradient instead of a solid color
> for the title bar.
>
> i like what you have, i'm only showing these examples as example style for canvas splash
> screen, title bar color schemes, keep the app shell inside the browser window and the buffalo
> aka Yak AI's mascot, Kay.

These pictures are style direction, not specs to copy. He likes the shell as built. Keep its
structure, its accessible names and its behaviour. Change only its look where these references
point.

## The references

- `mocks/solid-title-bar-atlas-splash.png` shows three things:
  - a solid deep green title bar with the traffic lights, and the bell and avatar on the right
  - the empty canvas as a splash: a faint line drawing of Atlas holding a circle, with the canvas
    copy and "Create blank thread" inside it
  - Kay, the yak mascot, at the canvas's bottom right, and the avatar showing Kay's face
- `mocks/oil-painting-title-bar.webp` shows the same splash under an oil-painting title bar (dark
  green trees, a subtle gradient), with a thin trim line in colour around the app area.
- `mocks/oil-painting-canvas-wash.webp` shows an oil-painting landscape washed behind the dotted
  canvas.
- The earlier references in `earlier/` are Kay's own desktop app, the title bar area, the window
  inside the browser, and the Conductor project rows the sidebar follows.
- `as-built/` has screenshots of the shell on this branch in the demo scenario (light, dark, a
  hovered project row, and the rail collapsed).
- `crops/` holds reference crops cut from the mocks, and `measurements.json` holds sizes and
  sampled colours.
  - Every colour in it was sampled from a mock, not declared by the brand. ADR-051 says brand
    colours come only from declared CSS, so map each one to a token, or add a token with its
    contrast measured (ADR-065).
  - Treat the crops of the mascot, the line drawing and the painting as placeholders. Ask Ethan
    for the source files before shipping them.
- `tasks.md` is the task list, with a falsifiable acceptance predicate for each task. It is the
  work.

## The base moves under you

`claude/kind-sagan-a3mwjn` is still being finished in another session. A web finisher is proving
the shell and fixing the last items, and pushes to it only once every gate is green. The items
are:

- sidebar hierarchy: mains indented under their project
- the long scenario rendering the same on every load
- the failure view for a migration error
- web-check
- the full gates

When `origin/claude/kind-sagan-a3mwjn` moves, `git merge origin/claude/kind-sagan-a3mwjn` into this
branch. Never rebase. For anything outside the polish, prefer its side. Check for it at the
start of each work unit.

## Constraints

- AGENTS.md binds you.
- Work in poteto mode (`.claude/skills/poteto-mode/SKILL.md`). It is Ethan's working mode for
  this repo.
- Kay's tokens stay the source of truth (ADR-082). No raw colour in a component. A new colour is
  a token in `packages/catalog/src/tokens.css`, with its light and dark values and its contrast
  measured beside it (ADR-065, ADR-090).
- New UI is shadcn. The catalog components listed in AGENTS.md stay hand-made.
- The accessible names in `docs/trail/evidence/projects-sidebar/contract.md` do not change. The
  levers depend on them: `node apps/web/scripts/workspace-check.mjs` checks P1 to P12 (P11 is
  the title bar and the window), and `node apps/web/scripts/web-check.mjs` is the regression run.
  Both must stay green.
- Dark mode, reduced motion, and a 700px-wide window (full-bleed) must all look right.
- Every settled design decision gets an ADR in `docs/adr/adr.md`, Proposed while explored and
  Accepted once built and proven.
- Headless Chromium in these containers may not match the Playwright pin. If a browser test
  cannot find its build, point `PLAYWRIGHT_BROWSERS_PATH` at a folder that links the pinned
  `chromium_headless_shell-<n>/chrome-headless-shell-linux64/chrome-headless-shell` name to the
  preinstalled `/opt/pw-browsers` build.

## Deliverable

Open a PR from `claude/kay-shell-polish` into `claude/kind-sagan-a3mwjn`. It is stacked, so it
merges after that branch. Include before and after screenshots, light and dark, for each area,
and the open questions for Ethan.
