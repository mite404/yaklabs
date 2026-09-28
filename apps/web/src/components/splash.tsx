// The splash on an empty canvas (ADR-113): a line drawing behind the words. It is a picture
// only: hidden from the tree, and a press or a carried card goes through it to the ground. Bottom
// to top: the dotted field, the carry's lit fill (the open space's ::before), the drawing, the
// words and the button.

/** The line drawing behind an empty canvas's words, drawn in `--splash-line` so it themes. */
export function SplashDrawing() {
  return (
    <div data-slot="canvas-splash" aria-hidden="true" className="splash pointer-events-none">
      <div data-slot="splash-drawing" className="splash-drawing absolute inset-6" />
    </div>
  );
}
