// The splash on an empty canvas (ADR-113): the painting as the open space's ground, a vignette
// over it behind the words, and Kay at the bottom right, over them. The layers are pictures
// only: hidden from the tree, and a press or a carried card goes through them to the ground.
// Bottom to top: the painting under its wash, the carry's lit fill (the open space's ::before),
// the vignette, the words and the button, Kay.

/**
 * The open space's copy, the two lines that say what the canvas is for. On the empty canvas they
 * are the hero's headline: the display serif at a hero size, the second line in italic as the
 * site sets its headlines. Beside lanes they are plain. The words are the same either way.
 */
export function OpenSpaceCopy({ hero }: { hero: boolean }) {
  return (
    <p className={hero ? "splash-copy font-serif text-ink" : "font-serif text-xl text-ink"}>
      Drag a text selection or card
      <br />
      <span className={hero ? "italic" : undefined}>to start a new thread with context</span>
    </p>
  );
}

/** The vignette over an empty canvas's painting, the wash a shade deeper towards the edges. */
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
