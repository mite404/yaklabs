# Later

Work we agreed is worth doing but have not started, kept in one place so nothing gets lost.
Each item says what it is and what it waits on; when one starts, it moves into an ADR, and it leaves
this list when it ships.

## Waiting on Ethan

- **Put a model key in the gateway.** `apps/gateway` streams from Claude once `ANTHROPIC_API_KEY`
  is set as a Worker secret; no key was available where the slice was built, so the real-model
  path is proven only against a fake upstream (ADR-088).
- **Deploy the Worker and register its address.** The share page and the thread now ship in the
  one Cloudflare Worker (ADR-086); creating it from the repo publishes under Ethan's account, and
  its address must join WorkOS's redirect URIs and CORS origins (ADR-084).
- **Check the token issuer against a real sign-in.** The gateway accepts the two issuer forms
  WorkOS documents; only a signed-in run shows which one this environment mints.

## Design

- **Move the remaining olive to ink.** The stepped slider, dictation controls, links and the primary
  button still use `--accent` (`#515e38`); moving them to ink leaves green only on button hovers
  (ADR-055, ADR-058).
- **Show my work as numbered steps.** Adopt the numbered-circle step list from the "Application
  simulator" screenshot, which fits the legibility story (ADR-036).
- **A drop between two lanes.** The canvas appends; dropping a highlight or a card between two
  lanes should open the new lane there (ADR-089). Lanes already reorder by their grip.
- **The row follows a carried lane.** A lane dragged to the pane's edge should scroll the row along,
  and a wheel mid-drag should move the drop slot with the row; today the slot is measured when the
  lane lifts (ADR-089). Escape should put a carried lane back, too.

## Engineering

- **Replies that produce cards.** The `Agent` seam still yields text only, so today's cards come
  from the seed thread. Next: the seam carries a card chunk, the worker declares the catalog as a
  tool, validates each `tool_use` with the catalog's schemas, and loops until the reply ends.
- **Card lanes that persist.** A card opened large on the canvas lasts the visit; keeping it means
  storing its envelope beside the hidden-lane list (ADR-089).
- **A keyboard path onto the canvas.** Drag and drop has none; the Create blank thread button is
  the only keyboard route, and a "send highlight to canvas" action on the selection would give it
  one. Lane widths and order do have one: arrow keys on a gap or a grip.
- **Make the catalog pass `noUncheckedIndexedAccess`.** Eight index reads in `interactive.ts` and
  `thread.ts` fail it, so `packages/runtime` keeps the flag off; the catalog should pass the
  shared base config.
- **Answer 503, not 401, when WorkOS's keys cannot be fetched.** A JWKS outage currently reads as
  "sign in again".
- **Transcripts as markdown files in OPFS.** ADR-081 has conversations saved as markdown and
  indexed in SQLite; the slice stores rows only, with an FTS5 index (ADR-088).
- **Two stories that still move between runs.** The dictation stories draw a simulated waveform
  from random samples, and `ReplyFails` types during its play function, so `shoot.mjs` can catch
  them mid-frame even under reduced motion; a seeded simulated source and a wait for the play
  function to finish would make every story byte-identical between runs.
- **Memoize the interactive card's chart.** Toggling "Show my work" re-renders the whole card, so
  Recharts swaps 14 SVG groups although the data is unchanged; memoizing the chart stops that. It
  moves no pixels, so it is tidying, not a fix (ADR-073).
- **Link Storybook to Figma.** Add `@storybook/addon-designs` so each story shows its Figma frame
  (node 20:2 in file `7CUcz6R7OEjSrfMcNW6A7D`).
- **Publish Storybook to Chromatic.** A shareable URL for the component lab, with visual diffs on
  each push.
- **Automate the Figma token watcher.** It only runs when someone fires it; a GitHub Action that
  triggers when `catalog-lab/src/tokens.css` changes would keep the Figma variables in sync on its
  own.

## Integration readiness

What would let Kay's team drop the lab into their TypeScript monorepo (see
`docs/05-kay-stack-and-data.md`).

- **Stop the global CSS from leaking.** `tokens.css` styles bare elements (`footer`, `button`, `a`,
  `body`, `*`); put it in a cascade layer and scope element rules under a root class, so it can live
  inside another app.
- **React as a peer dependency of the catalog.** It is `@yaklabs/catalog` in a pnpm workspace
  with an `exports` map now (ADR-087); a package Kay's monorepo installs would list React as a
  peer instead of a dependency.
- **Platform-aware shortcuts.** Show Ctrl on Windows where the lab says ⌘; Kay ships on macOS and
  Windows.
- **Tokens in a standard format** (DTCG JSON) alongside the CSS, for theming, plugins and the Figma
  sync.
- **Catalog schemas as JSON Schema**, generated from the zod schemas, so a harness can use them as
  tool definitions.

## Interview extras

Each one starts from a design decision and carries it one layer down, into a neighbouring role's
work; pick two or three.

- **Visual regression and accessibility checks in CI** (Design Engineer: Infrastructure, which asks
  for "state catalogs, screenshot and visual regression tests, and accessibility checks in CI").
  Playwright screenshots across the Storybook states plus axe; the chosen day-4 extra (ADR-086), and
  it contains the next one.
- **A theme that fails contrast cannot ship** (Design Engineer: Infrastructure). ADR-065 as a test
  over every text and UI pair in every theme.
- **A catalog MCP server** (Developer Experience). `list_components`, `validate_card`,
  `preview_card`, so agents building UI use the design system correctly.
- **An evaluation loop** (AI Harnesses). Run a real model against the catalog, measure how often
  cards validate and where they fail, tighten the schema, show the rate improve.
- **A flame graph and a `MessagePort` agent** (Frontend). Before and after the chart memo, and the
  `Agent` seam streaming across a worker boundary.
- **Deploy the share page on Cloudflare** (Cloud Infrastructure), Kay's own edge.
