// The splash on an empty canvas (ADR-113): the landscape under the dots as the open space's
// ground, and Kay at the bottom right, over the words. Both are pictures only: hidden from the
// tree, and a press or a carried card goes through them to the ground. Bottom to top: the
// painting under its wash and the dots, the carry's lit fill (the open space's ::before), the
// words and the button on their plate, Kay.

/** The landscape under an empty canvas's dots, washed with `--splash-wash` so it themes. */
export function SplashDrawing() {
  return (
    <div data-slot="canvas-splash" aria-hidden="true" className="splash pointer-events-none">
      <div data-slot="splash-drawing" className="splash-drawing absolute inset-0" />
    </div>
  );
}

/**
 * The open space's words and its button: on a paper plate over the painting while the splash
 * shows, and bare beside lanes, where the wrapper lays them out exactly as the open space's own
 * column would. The button is the catalog's own, the one a card's "Show my work" uses.
 */
export function Plate({ splash, onBlank }: { splash: boolean; onBlank: () => void }) {
  return (
    <div className="splash-plate flex flex-col items-center gap-4" data-plate={splash || undefined}>
      <p className="font-serif text-xl text-ink">
        Drag a text selection or card
        <br />
        to start a new thread with context
      </p>
      <button type="button" className="btn btn-sm" data-blank="" onClick={onBlank}>
        Create blank thread
      </button>
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
