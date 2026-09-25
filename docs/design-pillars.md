# Design pillars - the YakLabs visual language

Rules for building on-brand surfaces for Kay, reverse-engineered from yaklabs.ai and refined through prototyping.
Each rule states what to do, then why.
Sources are marked: **css** (declared in yaklabs.ai's stylesheet), **measured** (sampled from screenshots or recordings), **derived** (our choice), **estimated** (a guess awaiting a measurement).
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
The photo greens (`#161d17` to `#3d423b`) are for depth, overlays, and hover fills, not for flat accents: at their darkness they read as black.

### 6. Every colour goes through a semantic token

Components use only semantic tokens (`--ink`, `--text-body`, `--muted`, `--line`, `--accent`, `--accent-soft`, `--btn-*`), never raw hex.
The raw palette (`--yak-*`) exists only to feed the semantic layer, so rebranding is a one-block edit.

## Typography

### 7. Newsreader for display, Inter for everything else

Newsreader (serif, optical sizing) is for display moments: page headlines, the wordmark, thread titles.
Inter (sans, optical sizing) is for interface and body text.
Both are bundled locally (SIL Open Font License) so they render offline in the desktop app.

## Buttons

### 8. The outline button is the default

At rest a button is only an outline; on hover the fill and text colour change over 150ms with the default `ease` curve, while the border stays put.

| Property | Value | Source |
| --- | --- | --- |
| Font | Inter, 14px, medium (500), normal letter-spacing | css |
| Padding | 10px × 22px (compact: 6px × 14px at 13px) | css / derived |
| Corners | 4px | css |
| Rest fill | transparent | css |
| Rest outline | 1px, ink at 0.72 (`rgba(37, 37, 36, 0.72)`) | css |
| Rest text | ink `#252524` | css |
| Hover fill | `#242b24` forest | measured (hover recording) |
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

### 10. Bars are grounded: a fixed 20px darker base

Bars stay the data colour (olive `#515e38`) for most of their height and deepen over the bottom 20px to the olive-tinted display ink `#22251e`, like a soft shadow where they meet the axis.
The band is a fixed 20px on every bar, not a percentage, so tall and short bars are grounded identically; bars shorter than 20px fade over their full height.
The dark end uses the display ink rather than a photo green so the gradient stays in one hue family (OKLCH 124°).
The shade follows an ease-in-out curve (rule 11), so the band has no visible top edge.

| Property | Value | Source |
| --- | --- | --- |
| Bar colour | `--data` (olive `#515e38`) | derived |
| Base colour | `--data-deep` (display ink `#22251e`) | derived |
| Band height | 20px, fixed | Ethan |
| Band curve | smoothstep (ease-in-out), 9 stops | derived |
| Top corners | 4px | derived (matches the button) |

### 11. Ease gradients like motion

A linear gradient that starts or stops inside a shape creates a faint false line where it begins, because the eye exaggerates any sudden change in the rate of change (Mach banding).
Shape feathered gradients and shadows with an ease-in-out curve (smoothstep: zero slope at both ends), approximated with several colour stops, exactly as a camera move eases in and out.

## Spacing

### 12. Cards come to rest 20px above the compose box

The last card in a thread rests 20px above the compose box, or 20px above the card docked over it, and any card that grows (a data table, "Show my work") is nudged to that same line instead of opening underneath.
One resting line means the eye always finds new content in the same place, the way a lower third always sits at the same height on screen.
The gap is the token `--rest-gap`; the thread's bottom padding subtracts the compose row's 4px focus-ring inset (`--compose-inset`) so the visible gap is exactly 20px.

| Property | Value | Source |
| --- | --- | --- |
| Resting gap | 20px (`--rest-gap`) | Ethan |
| Compose row inset | 4px (`--compose-inset`) | derived (fits the 3px focus ring) |
| Nudge | smallest scroll; never upward | derived (ADR-038) |

## Open questions

- The hover rule itself (it did not print): confirm the fill `#242b24` and that the border really stays unchanged on hover.
- Where the declared `#111411` near-black green is used (likely the hero background) and where the declared soft blue `#95aac8` appears.
