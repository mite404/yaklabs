---
name: verify-storybook
description: >-
  Prove a UI component change in yaklabs by driving its Storybook stories in a real browser.
  Launches a private Storybook for catalog-lab, lists the stories a change can affect, renders
  them with screenshots and ARIA trees, and runs the story test suite (render, play functions,
  axe). Use after editing anything in catalog-lab/src or catalog-lab/.storybook, before claiming a
  component works, and when asked to verify, screenshot, or QA a component.
---

# Verify Storybook

The only surface in scope is the Storybook for `catalog-lab/` (React 19, Vite 7, Storybook 10). The
workbench app (`index.html`) and the share page (`share.html`) are out of scope until a web or
desktop app exists; their components are covered here through stories.

A story is the unit of proof. Every component a user sees renders through at least one story, and
`npm test` renders all of them in headless Chromium. This skill adds what the suite cannot tell
you: which stories your change reaches, what they look like, and whether an interaction you care
about actually works.

## Gate: what is already proven without a browser session

Run these first. They are cheap, and nothing below re-proves them.

| Tier | Command (from repo root) | Runs in |
| --- | --- | --- |
| Format | `npm run format:check` | CI; pre-commit writes staged files via lint-staged |
| Markdown wrap at 100 columns | `node scripts/wrap-md.js <file.md>` | pre-commit (staged `.md`) |
| Lint, incl. jsx-a11y and type-aware rules | `npm run lint` | CI, pre-commit |
| Types | `npm run typecheck` | CI, pre-commit |
| Unit tests (69, node) | `npm run test:unit` | CI, pre-commit |
| Story tests: every story renders, play functions pass, axe finds no violations | `npm run test:stories` | CI, pre-commit |
| Storybook builds | `npm run build-storybook` | CI |
| New dead code, complexity, duplication in changed files | `npx fallow audit --base HEAD` (this commit) or `npx fallow audit --base origin/main` (this branch) | pre-commit uses `HEAD`, CI uses the PR base |

- `oxlint` runs type-aware (`options.typeAware` plus the `oxlint-tsgolint` package), but it does not
  fold in `tsc` diagnostics, so `typecheck` is a separate tier, not a redundant one.
- `fallow audit` fails only on findings the change introduces. The full `npm run fallow` report
  exits 1 today on an inherited health backlog (large or complex functions in `ChatThreadPanel`,
  `DictationModal` and others). That backlog is not a gate; do not "fix" the gate by baselining it.
- There is no visual-regression tier. Axe checks contrast and semantics, not layout. Pixels are
  proven only by the screenshots this skill captures and a human or agent comparing them.

## Launch

```bash
.agents/skills/verify-storybook/scripts/control-storybook.sh launch
```

Ready when it prints `storybook: ready at http://127.0.0.1:6106/`. It starts
`storybook dev` on port 6106 (not 6006, so a human's `npm run storybook` is untouched), refuses to
start if a previous run's pid is alive or the port is taken, and waits for `/index.json` to list
this repo's stories. For a second concurrent run, set both `VERIFY_RUN_ID=<name>` and
`VERIFY_PORT=<free port>`; state lives in `/tmp/yaklabs-storybook-verify-<run id>/`.

## Doctor

```bash
.agents/skills/verify-storybook/scripts/control-storybook.sh doctor
```

`storybook doctor: OK` with `stories: 40` (or the current count) means the pid is ours, the port is
ours, and the index contains `foundations-button--default`. Run it whenever a page looks stale,
blank, or unfamiliar. A 200 from someone else's Storybook fails the content check.

## Bound the change

`catalog-lab/src/` is flat, so a directory does not bound a change; the import graph does. List
every story a change can reach:

```bash
node .agents/skills/verify-storybook/scripts/affected-stories.mjs --since main
node .agents/skills/verify-storybook/scripts/affected-stories.mjs catalog-lab/src/Menu.tsx
```

It follows fallow's impact closure, so editing `Menu.tsx` lists 32 stories (every card has a share
menu), not the 3 in `Menu.stories.tsx`. Edits to `.storybook/`, `tokens.css` or `primitives.css`
list every story. That list, together with the feature map, is the coverage set. Proving one
convenient story when the list names thirty is a sample, and reporting it as verified is wrong.

## Drive

Two harnesses, for two jobs.

**Render proof for many stories** (screenshot, ARIA tree, console errors):

```bash
node .agents/skills/verify-storybook/scripts/shoot.mjs \
  $(node .agents/skills/verify-storybook/scripts/affected-stories.mjs --since main)
```

Each story prints `PASS <id>` or `FAIL <id>` with the reason, then the paths of
`<id>.png` and `<id>.aria.yml`. FAIL means the story threw, logged `console.error`, showed
Storybook's error overlay, or rendered nothing. Pass `--width 420` for the narrow layouts.

**Interaction proof** (click, type, open, close): encode it as a `play` function in the story, then
run `npm run test:stories`. A play function is proof that reruns in CI forever; a manual click is
proof once. Use `storybook/test`:

```tsx
import { expect, userEvent, within } from "storybook/test";

export const ShareMenuOpens: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Share this card" }));
    await expect(canvas.getByRole("menuitem", { name: "Copy public link" })).toBeVisible();
  },
};
```

To explore before writing the play function, drive a story's standalone page in a browser tool:
`http://127.0.0.1:6106/iframe.html?id=<story-id>&viewMode=story`. In Claude Code use the
`mcp__chrome-devtools__*` or `mcp__mcp-server-playwright__*` tools; in Cursor use
`cursor-ide-browser`.

Handles: use ARIA roles and accessible names, which the feature files list per story (for example
`button "Share this card"`, `textbox "Message"`, `dialog "Listening 0:00"`). Never use CSS classes,
nth-child, or coordinates; the stories render the same components in several layouts.

## Evidence

- Artifacts go to `.artifacts/verify-storybook/<timestamp>/` at the repo root (gitignored).
  `shoot.mjs` writes there by default; pass `--out` to group a before/after pair.
- AGENTS.md requires a screenshot before and after when you touch a component. Run `shoot.mjs`
  on the affected stories before editing (`--out .artifacts/verify-storybook/<task>/before`) and
  again after (`.../after`), then compare each pair. Report every visual difference and whether it
  was intended.
- Proof is the user path: the story renders the real component with real props and fixtures. The
  one production boundary this surface mocks is the agent, `labAgent` stands in for a model and is
  the only acceptable stand-in. Do not stub a component, a hook, or `fetch` inside the component
  under test to make a story pass.
- An interaction proof names the action and the end state (`clicked "Share this card", menu
  "Share this card" lists "Copy public link" and "Open public page"`), not just a final screenshot.
- Browser APIs the headless run cannot grant (microphone, screen capture, clipboard permission)
  are unreachable here. Report them as verified-unreachable with the reason; do not report the
  simulated story as proof of the live path.

## Cleanup

```bash
.agents/skills/verify-storybook/scripts/control-storybook.sh stop
```

It kills only the pid this run recorded. Never `pkill storybook` or `killall node`: the user may
have their own Storybook and dev servers open. Evidence in `.artifacts/verify-storybook/` survives
cleanup; confirm the files are still there before reporting.

## Feature map

[`features/README.md`](features/README.md) indexes the user-facing features with their stories,
entry points, handles, and gotchas. The map, not convenience, defines what a change must cover.
Keep it current with `/maintain-verification-skill` when stories or components change.
