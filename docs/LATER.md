# Later

Work we agreed is worth doing but have not started, kept in one place so nothing gets lost.
Each item says what it is and what it waits on; when one starts, it moves into an ADR, and it leaves this list when it ships.

## Waiting on Ethan

- **Deploy the share page so links are really public.** `share.html` works locally and in Storybook (ADR-064); deploying it (a Vercel connector is available) publishes under Ethan's account, so it needs his OK first.

## Design

- **Move the remaining olive to ink.** The stepped slider, dictation controls, links and the primary button still use `--accent` (`#515e38`); moving them to ink leaves green only on button hovers (ADR-055, ADR-058).
- **Show my work as numbered steps.** Adopt the numbered-circle step list from the "Application simulator" screenshot, which fits the legibility story (ADR-036).

## Engineering

- **A real model behind the `Agent` seam.** Replace the scripted lab agent with a real model through a small server route that keeps the key off the browser (ADR-041); screenshots then need real file upload, since today attachments only ride along in the browser (ADR-063).
- **Memoize the interactive card's chart.** Toggling "Show my work" re-renders the whole card, so Recharts swaps 14 SVG groups although the data is unchanged; memoizing the chart stops that. It moves no pixels, so it is tidying, not a fix (ADR-073).
- **Link Storybook to Figma.** Add `@storybook/addon-designs` so each story shows its Figma frame (node 20:2 in file `7CUcz6R7OEjSrfMcNW6A7D`).
- **Publish Storybook to Chromatic.** A shareable URL for the component lab, with visual diffs on each push.
- **Automate the Figma token watcher.** It only runs when someone fires it; a GitHub Action that triggers when `catalog-lab/src/tokens.css` changes would keep the Figma variables in sync on its own.

## Integration readiness

What would let Kay's team drop the lab into their TypeScript monorepo (see `docs/05-kay-stack-and-data.md`).

- **Stop the global CSS from leaking.** `tokens.css` styles bare elements (`footer`, `button`, `a`, `body`, `*`); put it in a cascade layer and scope element rules under a root class, so it can live inside another app.
- **Package it, not just run it.** Turn `catalog-lab` into a workspace package with an `exports` map (components, `tokens.css`, schemas), React as a peer dependency, and pnpm.
- **Platform-aware shortcuts.** Show Ctrl on Windows where the lab says ⌘; Kay ships on macOS and Windows.
- **Tokens in a standard format** (DTCG JSON) alongside the CSS, for theming, plugins and the Figma sync.
- **Catalog schemas as JSON Schema**, generated from the zod schemas, so a harness can use them as tool definitions.

## Interview extras

Each one starts from a design decision and carries it one layer down, into a neighbouring role's work; pick two or three.

- **A theme that fails contrast cannot ship** (Design Engineer: Infrastructure). ADR-065 as a test over every text and UI pair in every theme.
- **A catalog MCP server** (Developer Experience). `list_components`, `validate_card`, `preview_card`, so agents building UI use the design system correctly.
- **An evaluation loop** (AI Harnesses). Run a real model against the catalog, measure how often cards validate and where they fail, tighten the schema, show the rate improve.
- **A flame graph and a `MessagePort` agent** (Frontend). Before and after the chart memo, and the `Agent` seam streaming across a worker boundary.
- **Deploy the share page on Cloudflare** (Cloud Infrastructure), Kay's own edge.
