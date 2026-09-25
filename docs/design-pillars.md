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

At rest a button is only an outline; on hover it fills with a dark green after a short beat, then clears promptly when the pointer leaves.
The delay belongs on the hover rule only, because a transition uses the destination state's timing: delay on the way in, none on the way out.

| Property | Value | Source |
| --- | --- | --- |
| Size | about 164 × 39px at 15px text | measured |
| Font | Inter, 15px, medium (500) | measured |
| Padding | 9px × 22px (compact: 6px × 14px at 13px) | measured / derived |
| Corners | 2px | measured |
| Rest fill | transparent | measured |
| Rest outline | 1px, ink at 0.72 (`rgba(37, 37, 36, 0.72)`) | css |
| Rest text | ink `#252524` | css |
| Hover fill | `#242b24` forest | measured (hover recording) |
| Hover text | off-white `#f0efea` | css |
| Transition duration | about 120ms | measured (~7 frames at 60Hz) |
| Transition delay | 60ms, hover-in only | estimated |
| Focus | 2px accent outline, 2px offset | derived |
| Disabled | 45% opacity, no hover | derived |

## Open questions

- The exact transition delay and easing: read them from the site's stylesheet with the DevTools snippet in the conversation log, then replace the estimate above.
- Where the declared `#111411` near-black green is used (likely the hero background) and where the declared soft blue `#95aac8` appears.
