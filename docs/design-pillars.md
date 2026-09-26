# Design pillars - the YakLabs visual language

Rules for building on-brand surfaces for Kay, reverse-engineered from yaklabs.ai and refined through prototyping.
Each rule states what to do, then why.
Sources are marked: **css** (declared in yaklabs.ai's stylesheet), **derived** (our choice), **Ethan** (Ethan's pick), **estimated** (a guess awaiting confirmation).
No brand colour is sampled from screenshots or recordings: the screen used had a blue-light filter, and filters and colour profiles shift pixels (ADR-051).
Decisions behind these rules live in `docs/adr/adr.md` (ADR-033 to ADR-035); tokens live in `catalog-lab/src/tokens.css`.

## Colour

### 1. There is no black: neutrals are olive-tinted

Headings, body copy, and the "Apply for this role" button all share one olive-yellow hue (about 107° in OKLCH) at very low colour strength (chroma 0.002 to 0.009).
Near-black at that hue reads as a dark green-black; the lighter body copy reads as brown-green.
Never use pure `#000` or a cool grey for text.

### 2. Tinted neutrals only show their tint at large sizes

The same ink looks green-black in a 40px serif headline and plain black in 14px button text.
Large glyphs carry enough ink area for the hue to register; small text does not, and a dark outline around it (as on the button) pushes it darker still.
Judge a tinted neutral at the size it will be used, never on a swatch.

### 3. Use the tinted ink only for display text

Apply a more visibly tinted ink (olive-leaning, e.g. `#22251e`) only to display text: Newsreader headlines and thread titles, where the tint can actually be seen.
Keep the site's declared ink (`#252524`) and body grey (`#4a4a47`) for UI and body text, where extra tint is invisible but can muddy contrast.
This mirrors the site itself: the headline reads green-black, the button reads black.

### 4. Body copy is a lighter step of the same ink

Headings use the ink; body copy is a solid grey at about 82% of it; meta text and outline borders use the ink at 0.72.
Implement steps as solid colours (`color-mix`), not transparency, so text stays clean on tinted surfaces.

### 5. Green comes from one hue family

The only green declared in the site's CSS is the sage `#c7cfba` (hue 124°); the UI accent `#515e38` is derived on that same hue so buttons, charts, chips, and bubbles read as one family.
Darker greens are mixed from the declared near-black green `#111411` rather than picked from the hero photo.

### 6. Every colour goes through a semantic token

Components use only named tokens, never raw hex. The core set uses yaklabs.ai's own names and values (`--paper`, `--paper-deep`, `--ink`, `--soft-ink`, `--rule`, `--hairline`, `--blue`, `--sage`, `--chalk`, `--moss`, `--rust`); colours the site does not declare carry a `--yak-` prefix, and roles such as `--accent`, `--bubble-*`, and `--btn-*` are built on top.

### The site's contrast pattern: two inks, two lines

yaklabs.ai uses two text inks and two line weights, and nothing else: `--ink` for headings (13.3:1 on paper), `--soft-ink` for body and all secondary text (`#565650` from the site's brand.css, 6.4:1), `--rule` (ink at 72%) for strong lines and outlines (5.7:1), and `--hairline` (ink at 25%) for borders and dividers.
We follow it exactly; a field's placeholder takes the rule's ink, one step greyer than body text, and text selection is `--blue` with ink, as on the site.
The raw palette (`--yak-*`) exists only to feed the semantic layer, so rebranding is a one-block edit.

### 16. Contrast is measured, never judged by eye

Text needs at least 4.5:1 and UI parts and graphics (rings, outlines, chart marks) at least 3:1, checked against every surface the colour lands on, including hover, selected and dark mode.
A colour that fails is flagged with its ratio before it ships, even when it was asked for: six colours that looked fine failed on measurement, most of them on the `#8a8a85` hover (ADR-065).

## Typography

### 7. Newsreader for display, Inter for everything else

Newsreader (serif, optical sizing) is for display moments: page headlines, the wordmark, thread titles.
Inter (sans, optical sizing) is for interface and body text.
Both are bundled locally (SIL Open Font License) so they render offline in the desktop app.

## Buttons

### 8. The outline button is the default

At rest a button is only an outline; on hover the fill and text colour change over 150ms with the default `ease` curve, and the border switches to the fill colour instantly (it is not in the transition).

| Property | Value | Source |
| --- | --- | --- |
| Font | Inter, 14px, medium (500), normal letter-spacing | css |
| Padding | 10px × 22px (compact: 6px × 14px at 13px) | css / derived |
| Corners | 4px | css |
| Rest fill | transparent | css |
| Rest outline | 1px, ink at 0.72 (`rgba(37, 37, 36, 0.72)`) | css |
| Rest text | ink `#252524` | css |
| Hover fill | `--moss` (`#263b30`) | css (the site's hover rule) |
| Hover outline | `--moss`, switches instantly | css |
| Hover text | off-white `#f0efea` | css |
| Transition | `background-color 0.15s, color 0.15s` (border not animated) | css |
| Easing | `ease` (the default) | css |
| Delay | none | css |
| Focus | 2px accent outline, 2px offset | derived |
| Disabled | 45% opacity, no hover | derived |

### 9. A perceived delay is often just duration

The button seemed to pause before filling, but its CSS has no delay: a 150ms `ease` transition is long enough to register as "a beat, then it arrives" rather than a snap.
Before adding a delay to make something feel deliberate, try a slightly longer duration; a real delay makes a control feel unresponsive.
Around 100ms reads as instant, around 150 to 200ms reads as a soft arrival, and past about 300ms a hover starts to feel sluggish.

## Data visualisation

### 10. Bars are flat

Bars are one flat data colour with the button's 4px top corners; the darker eased base they used to have did not work with the colour scheme and was removed (ADR-055).
Chart marks and their legend keys are graphite `#56564f` (6.4:1 on paper), a warm neutral, so green stays for button hovers (ADR-058).

### 12. Cards come to rest 20px above the compose box

The last card in a thread rests 20px above the compose box, or 20px above the card docked over it, and any card that grows (a data table, "Show my work") is nudged to that same line instead of opening underneath.
One resting line means the eye always finds new content in the same place, the way a lower third always sits at the same height on screen.
The gap is the token `--rest-gap`; the thread's bottom padding subtracts the compose row's 4px focus-ring inset (`--compose-inset`) so the visible gap is exactly 20px.

| Property | Value | Source |
| --- | --- | --- |
| Resting gap | 20px (`--rest-gap`) | Ethan |
| Compose row inset | 4px (`--compose-inset`) | derived (fits the 3px focus ring) |
| Nudge | smallest scroll; never upward | derived (ADR-038) |

## Surfaces

### 13. Attention gets its own surface (light and dark)

The thread's cards all sit on paper, so anything that needs the user (the Recap, a "Needs you" question) sits on the attention surface, a pale warm grey, and stands apart without a badge or a colour of alarm.
Its choices are paper tiles, lighter than the card, so they separate by colour; hovering a row darkens it to a mid grey, where the usual inks fail, so the hovered row's text switches to the darkest ink.
Green appears only as a button hover: Submit fills with the site's moss, as the outline button does.
Both cards cast their shadow down and to the right, as if lit from the top left, and never on the top or left edge (ADR-069).
The question card, labelled "Needs attention", is the exception: it sits on the app's paper with no grey fill at rest, its options, header and Skip fill with `--paper-deep` only on hover, and its label is a caution orange pill (ADR-067, ADR-068).

| Property | Value | Source |
| --- | --- | --- |
| Surface (light) | `--attention-bg` (`#d6d5cf`), ink 10.4:1, soft-ink 4.6:1 | Ethan |
| Tiles (light) | `--tile-bg` (`--paper`), 1.3:1 against the card, soft-ink 5.8:1 | derived |
| Hover (light) | `--attention-hover` (`#8a8a85`), text to `#111411` at 5.4:1 | Ethan |
| Question card rest / hover | no fill / `--paper-deep` (`#e4e4df`), ink 12.0:1, soft-ink 5.8:1 | Ethan |
| Question label | `--yak-orange` (`#d19456`) with `--yak-brown-ink` (`#3b2612`), 5.5:1 | Ethan |
| Focus (light) | ink ring, 10.4:1 (the page's grey ring is 2.3:1 here) | derived |
| Surface (dark) | `#62625d`, paper text 5.3:1 | Ethan |
| Tiles (dark) | 18% night on the surface, paper 6.6:1 | derived |
| Hover (dark) | 50% night on the surface (`#3a3b37`), paper 9.8:1 | derived |

## Inputs

### 14. A place to type is outlined, and its prompt is greyer

A text field uses the outline button's 1px border and 4px corners, so it belongs to the same family as the button and never reads as plain text.
Its placeholder is greyer than any statement around it, because a placeholder asks and a statement tells; on the strong surface a faint recessed fill keeps that greyer placeholder above 4.5:1.

| Property | Value | Source |
| --- | --- | --- |
| Border | 1px, ink at 0.72 (as the button) | css |
| Corners | 4px | css |
| Padding | 5px × 10px, 13px text | derived |
| Placeholder (paper) | `--rule` (ink at 72%), 5.7:1 | css |
| Placeholder (strong) | 78% paper on a 12% night fill, 4.6:1 | derived |
| Border (strong) | 60% paper, 3.5:1 | derived |
| Hover and focus | border to full ink; focus adds the 2px ring | derived |

### 15. The sage tint means "you"

The user's bubble is the only place the sage-green tint appears, so it always means "this is what you said"; chips, badges, and tags use the neutral wash.
The tokens are named `--bubble-tint`, `--bubble-tint-strong`, and `--bubble-line`, so the tint cannot be reused by accident.

## Open questions

- Whether the stepped slider, dictation controls, links and the primary button should move from olive to ink, so green only appears on button hovers (tracked in `docs/LATER.md`).

- Rules 2 and 3 (and the display ink `#22251e`) rest on how the tint looked on a screen with a blue-light filter, which warms dark neutrals: re-check them with the filter off.
- Ethan's warm greys (`#8a8a85`, `#cbcac4`) were picked on the same screen: keep them as deliberate choices, or re-pick them with the filter off.
- Where the declared `#111411` near-black green is used (likely the hero background) and where the declared soft blue `#95aac8` appears.
