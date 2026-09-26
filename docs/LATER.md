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
- **Link Storybook to Figma.** Add `@storybook/addon-designs` so each story shows its Figma frame (node 20:2 in file `7CUcz6R7OEjSrfMcNW6A7D`).
- **Publish Storybook to Chromatic.** A shareable URL for the component lab, with visual diffs on each push.
- **Automate the Figma token watcher.** It only runs when someone fires it; a GitHub Action that triggers when `catalog-lab/src/tokens.css` changes would keep the Figma variables in sync on its own.
