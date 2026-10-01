# The design tooling page's pictures

Ethan supplied every picture here: screenshots of `tools/verify-ui-drift`'s review app, taken on
his Mac at 2x, each 2000px wide and re-encoded as WebP. The page at `/verify-ui-tooling` shows
them (ADR-160).

- `pixels-workbench.webp` (2000x1551, about 75 KB): the Pixels workbench on Button / Default,
  changed by 3,776 pixels, with the before/after wipe and the 4x pixel inspector on one corner.
- `comparator-proof.webp` (2000x963, about 52 KB): Comparator proof, the unchanged control and
  the colour and geometry mutations in Chromium, with the counts for all three engines.
- `contrast-kay.webp` (2000x979, about 71 KB): the Accessibility tab's Contrast in context
  under the Kay lens, every declared token pair in both themes.
- `contrast-material.webp` (2000x420, about 34 KB): the same table under the Material lens.

The seal on the welcome and on the page is drawn by
`apps/web/src/components/design-tooling-seal.tsx`;
no picture is needed for it.
