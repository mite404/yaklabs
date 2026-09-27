// The splash on an empty canvas (ADR-113): a line drawing behind the words, and Kay at the
// bottom right, over them. Both are pictures only: hidden from the tree, and a press or a carried
// card goes through them to the ground. Bottom to top: the dotted field, the carry's lit fill
// (the open space's ::before), the drawing, the words and the button, Kay.

/** The line drawing behind an empty canvas's words, drawn in `--splash-line` so it themes. */
export function SplashDrawing() {
  return (
    <div data-slot="canvas-splash" aria-hidden="true" className="splash pointer-events-none">
      <div data-slot="splash-drawing" className="splash-drawing absolute inset-6" />
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
