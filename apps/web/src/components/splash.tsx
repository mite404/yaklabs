// The splash on an empty canvas (ADR-113), a codex sheet: a sheet of paper on the dotted desk,
// Leonardo's construction marks and the Atlas figure behind the words, and Kay at the bottom
// right, over them. All of them are pictures only: hidden from the tree, and a press or a carried
// card goes through them to the ground. Bottom to top: the dotted field, the sheet, the carry's
// lit fill (the open space's ::before), the construction and the figure, the words and the
// button, Kay.

/**
 * The sheet, the construction and the figure behind an empty canvas's words, each a CSS mask
 * filled with a token (`--paper`, `--splash-line` and `--splash-ink`) so it themes.
 */
export function SplashDrawing() {
  return (
    <div data-slot="canvas-splash" aria-hidden="true" className="splash pointer-events-none">
      <div data-slot="splash-sheet" className="splash-sheet" />
      <div data-slot="splash-codex" className="splash-codex" />
      <div data-slot="splash-drawing" className="splash-drawing" />
    </div>
  );
}

/**
 * Kay at the bottom right of an empty canvas. He stays away from an open space under 480px, a
 * content box under 430px, where he would crowd the words.
 */
export function Kay() {
  return (
    <img
      data-slot="kay-mascot"
      src="/kay/kay.webp"
      alt=""
      aria-hidden="true"
      width={96}
      height={110}
      className="splash-in pointer-events-none absolute right-6 bottom-6 hidden w-24 @min-[430px]:block"
    />
  );
}
