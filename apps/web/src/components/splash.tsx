// The splash on an empty canvas (ADR-113, ADR-135): a picture behind the words, in one of
// three looks the debug switch picks (splash.ts) and index.css draws off `<html data-splash>`.
// It is a picture only: hidden from the tree, and a press or a carried card goes through it to
// the ground. Bottom to top: the paper, the carry's lit fill (the open space's ::before), the
// picture, the field's dots, the words and the button.

/**
 * The picture behind an empty canvas's words: the landscape or the abstract painting at the
 * open space's edges, clearing to paper behind the words, or Atlas with his globe ringing
 * them, faded out at the feet. Which one is the look on `<html data-splash>`.
 */
export function SplashDrawing() {
  return (
    <div data-slot="canvas-splash" aria-hidden="true" className="splash pointer-events-none">
      <div data-slot="splash-drawing" className="splash-drawing" />
    </div>
  );
}
