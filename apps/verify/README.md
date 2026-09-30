# Yaklabs UI Verification Tool

Internal Use Only.

A local review tool for Kay's UI. It captures production components through their existing Storybook
stories, compares screenshots with approved references, and checks CSS tokens, contrast, and
accessibility. It can also capture the SPA shell.

Use it to catch visual drift as humans and agents change the product. Code is the source of truth;
Figma receives token exports. Automated checks find differences. A person decides whether an
intentional visual change should become the new reference.

## Run it

From the repository root, using Node 26 and the repository's pinned pnpm version:

```sh
pnpm install --frozen-lockfile
pnpm --filter verify exec playwright install --with-deps chromium firefox webkit
pnpm verify run
pnpm verify review
```

The default run captures five foundation stories in light and dark themes across Chromium, Firefox,
and WebKit. Add `--app` to include the SPA shell, or use `--stories STORY_ID` to select a component
state. Missing references leave the comparison incomplete, not passing.

Open the address printed by the review command. In an Amp orb, start a supervised service and use
its portal instead:

```sh
amp orb service start kay-verify --command 'pnpm verify review' --portal
```

The review app reads saved evidence. **Reload saved report** reloads the selected run without taking
new screenshots. To capture code changes, rerun the CLI with the same selection.

## From design to drift check

1. Explore in Figma or code. Implement the component with semantic CSS tokens and add or update its
   Storybook stories.
2. Capture the affected stories with the CLI. Include the app shell when checking composition.
3. Select a run in the review app. Use **Pixels** for before/after comparison and pixel inspection,
   **Tokens** for color usage, and **Accessibility** for contrast and axe's automated findings.
   **Comparator proof** checks that the tool detects deliberately introduced mistakes.
4. Fix unintended differences and capture again. If the change is intentional, inspect it before
   approving a replacement reference.
5. Rerun the comparison, then commit the code and approved references together. Future runs compare
   against those references so later drift stays visible.

## What approval means

Approval accepts a screenshot as the baseline for that component state and rendering environment.
Each browser and theme has its own reference. A matching capture needs no new approval; a changed
capture needs review. Approval does not fix code or certify accessibility.
Keyboard and screen-reader checks still need human review.

After inspecting a capture, copy its command from **Review and approve this capture**:

```sh
pnpm verify approve --run RUN_ID --keys foundations-button--default.chromium.light --expect 1
pnpm verify run
```

Approval writes a PNG and `approved.json` under `apps/verify/baselines/`.
Commit these with the code.
Reports and comparison images live in `.artifacts/verify/runs/`, which Git ignores.

The CLI rejects stale or incomplete evidence, failed comparator checks, altered images, and selected
captures with axe violations. CI cannot approve references. Never approve an unexplained difference
just to make a check pass.

## Check the tool itself

After a default capture run, check the tool with:

```sh
pnpm --filter verify test
pnpm --filter verify typecheck
pnpm --filter verify test:review
```

For capture options and exit codes, run `pnpm verify --help`.
