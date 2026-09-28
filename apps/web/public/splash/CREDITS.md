# The canvas splash

Three pictures, one per look of the empty canvas (ADR-135), all supplied by Ethan. Their origin
and licence are still to be confirmed (Q11 in `docs/reference/shell-polish/tasks.md`).

- `landscape.webp` (1280x853, about 267 KB) is Ethan's oil painting of a river valley, resized
  from his 1536x1024 file and re-encoded at quality 78. It is a CSS background under
  `--splash-wash-landscape`, masked to a clearing behind the words, with the field's dots over it.
- `abstract.webp` (1280x1024, about 264 KB) is Ethan's abstract oil brush strokes, resized from
  the 1402x1122 file in his Figma frame "App Shell - Splash - Abstract" and re-encoded the same
  way. Drawn as the landscape is, under `--splash-wash-abstract`.
- `atlas.webp` (635x1081, about 73 KB, lossless) is Ethan's Atlas figure holding the globe, cut
  to a stencil: black strokes on alpha, with his fade towards the feet baked into the alpha. It
  is a CSS mask filled with `--splash-figure`, so only the strokes show and they theme with the
  ink.
