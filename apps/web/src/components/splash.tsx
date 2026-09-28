// The splash on an empty canvas (ADR-113): the cutting mat's furniture and Atlas behind the
// words, and Kay at the bottom right, over them. All of it is pictures only: hidden from the
// tree, and a press or a carried card goes through them to the ground. Bottom to top: the mat's
// grid, the carry's lit fill (the open space's ::before), the mat's lines, rulers and circles,
// Atlas, the words and the button, Kay.

/**
 * The drawing behind an empty canvas's words: the mat's centre lines, diagonals, rulers and
 * construction circles in `--splash-line`, and Atlas holding his globe around the words in
 * `--splash-figure`, every piece a mask filled with a token so it themes.
 */
export function SplashDrawing() {
  return (
    <div data-slot="canvas-splash" aria-hidden="true" className="splash pointer-events-none">
      <div className="splash-lines absolute inset-0" />
      <div className="splash-rulers absolute inset-0" />
      <div data-slot="splash-circles" className="splash-circles absolute" />
      <div data-slot="splash-drawing" className="splash-drawing absolute" />
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
