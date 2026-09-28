// The splash on an empty canvas (ADR-113, ADR-136): the field's dots, a clearing of plain paper
// behind the words, a sheet of construction lines and Atlas with his globe ringing the words,
// all drawn in index.css. It is a picture only: hidden from the tree, and a press or a carried
// card goes through it to the ground. Bottom to top: the paper, the carry's lit fill (the open
// space's ::before), the dots, the lines, the clearing, Atlas, then the words and the button.

/**
 * The picture behind an empty canvas's words: dots and construction lines on the raised
 * surface, cleared to plain paper behind the words, with Atlas over them, his globe ringing the
 * words.
 */
export function SplashDrawing() {
  return (
    <div data-slot="canvas-splash" aria-hidden="true" className="splash pointer-events-none">
      <div className="splash-dots" />
      <div className="splash-lines" />
      <div className="splash-clearing" />
      <div data-slot="splash-drawing" className="splash-drawing" />
    </div>
  );
}
