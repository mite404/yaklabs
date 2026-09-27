# The painted title bar

- `painting.webp` (2880x88, about 5 KB) is an original painting made for this repo by
  `apps/web/scripts/paint-chrome.mjs`: misty green-grey ground with dark tree canopies at the
  top, from seeded SVG noise, so it is the same on every run. Source: that script. Licence:
  none needed, it is ours.
- It follows the style of Ethan's mock
  (`docs/reference/shell-polish/mocks/oil-painting-title-bar.webp`)
  without copying its pixels, and stands in until Ethan names the painting he wants, where it is
  from and under what licence (Q4 in `docs/reference/shell-polish/tasks.md`).
- The script holds every pixel at or below luminance 0.131, so cream text stays above 4.5:1
  anywhere on the bar. A painting that replaces it has to pass through the same step.
