# The canvas splash drawing

- `atlas.webp` (635x1081, lossless, about 74 KB) is the Atlas figure holding the globe, supplied
  by Ethan from his own file: a stencil of black strokes on nothing, fading out towards the
  feet. Where it comes from and under what licence is still to be confirmed (Q11 in
  `docs/reference/shell-polish/tasks.md`).
- `vitruvian.svg` is an original drawing made for this repo by
  `apps/web/scripts/draw-vitruvian.mjs`: Leonardo's square with a circle inside it and a
  protractor of ticks between the two. No licence is needed.
- Both are drawn as CSS masks, the sheet filled with `--splash-line` and the figure with
  `--splash-figure`, so only the strokes show and the drawing themes with the ink.
