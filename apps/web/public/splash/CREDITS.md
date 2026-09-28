# The canvas splash drawing

- `atlas.webp` is the Atlas figure holding his globe, supplied by Ethan from his own file as a
  stencil: black strokes on transparent, fading to nothing towards the feet. Its origin and
  licence are still to be confirmed (Q11 in `docs/reference/shell-polish/tasks.md`).
- `mat-circles.svg` is an original drawing made for this repo: the cutting mat's construction
  circles, concentric with the globe. No licence is needed.
- Both are CSS masks filled with a token (`--splash-figure` for Atlas, `--splash-line` for the
  circles), so only the strokes show and the drawing themes with the ink. The mat's rulers,
  centre lines and diagonals are CSS gradients in `apps/web/src/index.css`.
