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
