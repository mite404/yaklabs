# Design pillars - the YakLabs visual language

Rules for building on-brand surfaces for Kay, reverse-engineered from yaklabs.ai and refined through
prototyping.
Each rule states what to do, then why.
Sources are marked: **css** (declared in yaklabs.ai's stylesheet), **derived** (our choice),
**Ethan** (Ethan's pick), **estimated** (a guess awaiting confirmation).
No brand colour is sampled from screenshots or recordings: the screen used had a blue-light filter,
and filters and colour profiles shift pixels (ADR-051).
Decisions behind these rules live in `docs/adr/adr.md` (ADR-033 to ADR-035); tokens live in
`packages/catalog/src/tokens.css`.

## Colour

### 1. There is no black: neutrals are olive-tinted

Headings, body copy, and the "Apply for this role" button all share one olive-yellow hue (about
107° in OKLCH) at very low colour strength (chroma 0.002 to 0.009).
Near-black at that hue reads as a dark green-black; the lighter body copy reads as brown-green.
Never use pure `#000` or a cool grey for text.

### 2. Tinted neutrals only show their tint at large sizes

The same ink looks green-black in a 40px serif headline and plain black in 14px button text.
Large glyphs carry enough ink area for the hue to register; small text does not, and a dark outline
around it (as on the button) pushes it darker still.
Judge a tinted neutral at the size it will be used, never on a swatch.

### 3. Use the tinted ink only for display text

Apply a more visibly tinted ink (olive-leaning, e.g. `#22251e`) only to display text: Newsreader
headlines and thread titles, where the tint can actually be seen.
Keep the site's declared ink (`#252524`) and body grey (`#4a4a47`) for UI and body text, where extra
tint is invisible but can muddy contrast.
This mirrors the site itself: the headline reads green-black, the button reads black.

### 4. Body copy is a lighter step of the same ink

Headings use the ink; body copy is a solid grey at about 82% of it; meta text and outline borders
use the ink at 0.72.
Implement steps as solid colours (`color-mix`), not transparency, so text stays clean on tinted
surfaces.

### 5. Green comes from one hue family

The only green declared in the site's CSS is the sage `#c7cfba` (hue 124°); the UI accent `#515e38`
is derived on that same hue so buttons, charts, chips, and bubbles read as one family.
Darker greens are mixed from the declared near-black green `#111411` rather than picked from the
hero photo.

### 6. Every colour goes through a semantic token

Components use only named tokens, never raw hex. The core set uses yaklabs.ai's own names and values
(`--paper`, `--paper-deep`, `--ink`, `--soft-ink`, `--rule`, `--hairline`, `--blue`, `--sage`,
`--chalk`, `--moss`, `--rust`); colours the site does not declare carry a `--yak-` prefix, and roles
such as `--accent`, `--bubble-*`, and `--btn-*` are built on top.

### The site's contrast pattern: two inks, two lines

yaklabs.ai uses two text inks and two line weights, and nothing else: `--ink` for headings (13.3:1
on paper), `--soft-ink` for body and all secondary text (`#565650` from the site's brand.css,
6.4:1), `--rule` (ink at 72%) for strong lines and outlines (5.7:1), and `--hairline` (ink at 25%)
for borders and dividers.
We follow it exactly; a field's placeholder takes the rule's ink, one step greyer than body text,
and text selection is `--blue` with ink, as on the site.
The raw palette (`--yak-*`) exists only to feed the semantic layer, so rebranding is a one-block
edit.

### 16. Contrast is measured, never judged by eye

Text needs at least 4.5:1 and UI parts and graphics (rings, outlines, chart marks) at least 3:1,
checked against every surface the colour lands on, including hover, selected and dark mode.
A colour that fails is flagged with its ratio before it ships, even when it was asked for: six
colours that looked fine failed on measurement, most of them on the `#8a8a85` hover (ADR-065).

## Typography

### 7. Newsreader for display, Inter for everything else

Newsreader (serif, optical sizing) is for display moments: page headlines, the wordmark, thread
titles.
Inter (sans, optical sizing) is for interface and body text.
Both are bundled locally (SIL Open Font License) so they render offline in the desktop app.

## Buttons

### 8. The outline button is the default

At rest a button is only an outline; on hover the fill and text colour change over 150ms with the
default `ease` curve, and the border switches to the fill colour instantly (it is not in the
transition).

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

### 17. A toggle never moves when its label flips

A button that switches between two labels keeps one whole-pixel width (128px, the widest label) and
shares a whole-pixel line with the text beside it, so nothing in the footer shifts between states,
not even by a rounded pixel (ADR-072).

### 9. A perceived delay is often just duration

The button seemed to pause before filling, but its CSS has no delay: a 150ms `ease` transition is
long enough to register as "a beat, then it arrives" rather than a snap.
Before adding a delay to make something feel deliberate, try a slightly longer duration; a real
delay makes a control feel unresponsive.
Around 100ms reads as instant, around 150 to 200ms reads as a soft arrival, and past about 300ms a
hover starts to feel sluggish.

### 27. A place outside the demo keeps its name, and says so

A place in the rail that this demo leaves out of scope stays in the rail, named in its pill and in
the phone drawer's row and reached by keyboard, but it opens nothing and says "Out of demo scope"
(Ethan; ADR-094, amended; ADR-144).
It is drawn in faint ink, never at reduced opacity: the 45% of a disabled button (rule 8) takes a
rail glyph to 2.0:1 on paper, under rule 16's 3:1.
It has no hover fill and no step to ink, since there is nothing to press, so the fill still means
"this opens something".
The rail checks' P23 and P25 measure all of this in both themes.

| Property | Value | Source |
| --- | --- | --- |
| Glyph and name | `--faint-ink`, an archived row's: 5.17:1 on paper, 5.46:1 dark | derived |
| Hover | none: no fill, no step to ink, the arrow cursor | derived |
| Words | "Out of demo scope", the same in the pill, the drawer row and to a screen reader | Ethan |
| Pill | name, then "· Out of demo scope", `--on-ink` 72% over `--ink` (rule 4): 7.6:1, 6.9:1 | derived |
| Drawer row | the words after the name, 12px, as the thread count sits | derived |
| Screen reader | a button, `aria-disabled`, described by the words | derived |

## Data visualisation

### 10. Bars are flat

Bars are one flat data colour with the button's 4px top corners; the darker eased base they used to
have did not work with the colour scheme and was removed (ADR-055).
Chart marks and their legend keys are graphite `#56564f` (6.4:1 on paper), a warm neutral, so green
stays for button hovers (ADR-058).

### 12. Cards come to rest 20px above the compose box

The last card in a thread rests 20px above the compose box, or 20px above the card docked over it,
and any card that grows (a data table, "Show my work") is nudged to that same line instead of
opening underneath.
One resting line means the eye always finds new content in the same place, the way a lower third
always sits at the same height on screen.
This holds even for a card that grows taller than the view: its top scrolls off, because the bottom
edge is what tells the user the whole card has been shown (ADR-071).
The gap is the token `--rest-gap`; the thread's bottom padding subtracts the compose row's 4px
focus-ring inset (`--compose-inset`) so the visible gap is exactly 20px.

| Property | Value | Source |
| --- | --- | --- |
| Resting gap | 20px (`--rest-gap`) | Ethan |
| Compose row inset | 4px (`--compose-inset`) | derived (fits the 3px focus ring) |
| Nudge | smallest scroll; never upward | derived (ADR-038) |

## Surfaces

### 13. Attention gets its own surface (light and dark)

The thread's cards all sit on paper, so anything that needs the user (the Recap, a "Needs you"
question) sits on the attention surface, a pale warm grey, and stands apart without a badge or a
colour of alarm.
Its choices are paper tiles, lighter than the card, so they separate by colour; hovering a row
darkens it to a mid grey, where the usual inks fail, so the hovered row's text switches to the
darkest ink.
Green appears only as a button hover: Submit fills with the site's moss, as the outline button does.
Both cards cast their shadow down and to the right, as if lit from the top left, and never on the
top or left edge (ADR-069).
The question card, labelled "Needs attention", is the exception: it sits on the app's paper with no
grey fill at rest, its options, header and Skip fill with `--paper-deep` only on hover, and its
label is a caution orange pill (ADR-067, ADR-068).

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

### 28. A hover label is an ink pill

Anything that names itself on hover or focus (a rail place, Unpin, a layout, Collapse all, a
sidebar row's cut name) does it in one look: the rail's ink pill, which Ethan kept ("it looks
great"), not shadcn's square box with an arrow.
There is one tooltip in `packages/ui` and it draws only this, so a new label cannot come out in
another shape.
The page's ink, turned over, stands out from the paper shell in either theme without a shadow.
Its corners are half a one-line pill's height, so one line is a capsule, and a name long enough to
wrap keeps the same ends instead of turning into a lozenge.
It waits for the pointer to rest, so passing over a row of icons does not flash a label at each,
and once one is up its neighbours open at once.
Storybook has no story for it: Storybook holds the catalog's hand-made primitives, and this is
the vendored shadcn tooltip. P23 reads the rail's pills in both themes.

| Property | Value | Source |
| --- | --- | --- |
| Fill / text | `--ink` / `--on-ink`: 13.3:1 light, 16.1:1 dark | derived (ADR-144) |
| Secondary words | `--on-ink` 72% over `--ink` (rule 4): 7.6:1, 6.9:1 | derived (ADR-144) |
| Type | Inter 13px, medium, 16px line, one line unless a name must wrap (up to 320px) | derived |
| Padding | 4px × 10px | derived |
| Corners | 12px: half the one-line pill's 24px, a capsule on one line | derived |
| Offset | 8px off its trigger, no arrow | derived (ADR-144) |
| Delay | 350ms of rest, then the next opens at once | derived (ADR-144) |
| Motion | in over 125ms, `cubic-bezier(0.23, 1, 0.32, 1)`, scale 0.97 and fade; out in 100ms | derived |
| Reduced motion | fades only, no scale | derived |

## Inputs

### 14. A place to type is outlined, and its prompt is greyer

A text field uses the outline button's 1px border and 4px corners, so it belongs to the same family
as the button and never reads as plain text.
Its placeholder is greyer than any statement around it, because a placeholder asks and a statement
tells; on the strong surface a faint recessed fill keeps that greyer placeholder above 4.5:1.

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

The user's bubble is the only place the sage-green tint appears, so it always means "this is what
you said"; chips, badges, and tags use the neutral wash.
The tokens are named `--bubble-tint`, `--bubble-tint-strong`, and `--bubble-line`, so the tint
cannot be reused by accident.

## Motion

Two kinds of motion, with two sets of rules: **feedback** answers a user's action (a hover, a
menu opening) and should be brief; **status** loops while the agent works and should feel steady.
The status glyphs live in `packages/catalog/src/motion.css` (Storybook: Motion), and the reasoning
behind each rule below is told in `docs/FOR_ETHAN.md`.

| Motion | Duration | Curve | Source |
| --- | --- | --- | --- |
| Button fill and text on hover (rule 8) | 150ms | `ease` | css |
| Menu opening | 120ms | `ease-out` | derived |
| Modal fade, then rise | 160ms, 200ms | `ease-out` | derived |
| A loading thread's "Opening ..." line | shown after 100ms | none, steps in | derived (rule 9) |
| The empty canvas's splash, arriving | 150ms fade in | `ease-out` | derived (ADR-113) |
| A new thread's welcome picture | none, arrives with its words | none | derived (the paintings) |
| Agent working glyph (wave, orbit) | 2000ms loop | `linear` fades | Ethan |
| Agent tree glyph | 2000ms loop | `linear` fades, `cubic-bezier(0.4, 0, 0.6, 1)` scroll | Ethan |
| Sidebar peek slide, out and back (rule 26) | 220ms | `cubic-bezier(0.17, 1.02, 0.58, 1)` (`--panel-ease`) | Ethan |
| Sidebar peek out, the panel's strength | none: full strength from the first frame, as a pin | none | Ethan |
| Sidebar peek fade back, to the slide's end | 120ms | `cubic-bezier(0.68, 0, 0.77, 0)` | derived |
| Sidebar rows, leaving on a peek's way back or an unpin | 60ms (`--rows-leave`), at 0 by the curve's 75% mark | `cubic-bezier(0.23, 1, 0.32, 1)` | derived (Ethan) |
| Sidebar rows, a pointer turning a peek back mid-way | 120ms | `cubic-bezier(0.23, 1, 0.32, 1)` | derived |
| The peek's edge through a pin from a peek | held, then off at the pin's last frame (a 0s step after `--panel-pin`) | none, steps | Ethan |
| The rail's divider through a pin and an unpin | on at the pin's first frame; off at the unpin's last (a 0s step after `--panel-pin`) | none, steps | Ethan |
| Sidebar pin and unpin (the panel behind the rail, workspace and tabs in step) | 250ms (`--panel-pin`); none under reduced motion (rule 24) | `cubic-bezier(0.17, 1.02, 0.58, 1)` (`--panel-ease`) | Ethan |
| Sidebar peek under reduced motion (rule 24) | none: no slide and no fade | none | Ethan |

### 18. A working indicator reads as steady work, never an alert

Status loops run at 2000ms and include a rest: all motion fits in the first 65% of a shape's
cycle, and the rest of the loop is still (Ethan). The orbit is the one exception: a circle has
no end to rest at, so its steadiness comes from an even pace instead.
An alarm never pauses; a rest is what separates "busy" from "look at me".
The first sketch ran at 150ms, about seven loops a second, and read as flicker; 2000ms was
chosen after comparing 1500 to 2500ms side by side.

### 19. Colour follows opacity: solid is darkest

A shape at full opacity is the darkest green on the surface; as it fades it lightens, so the tints
come from transparency, not from extra colours (Ethan).
In dark mode the ramp flips, so "solid" still means the most contrast against the paper.
Use only brand greens: moss, yak-green, sage, the chrome greens, and `color-mix` blends of them.
Where a loop should feel alive rather than mechanical, draw each flash's shade from a set of
seven, change it only while the shape is invisible (one shade per flash, never a smear), and keep
neighbours on different shades (Ethan; the wave glyph).

### 20. One clock per glyph; offsets, never a second track

Every shape in a glyph plays the same keyframes from one `--working-duration`, offset by delays,
so changing the duration can never pull them out of step (derived).
Write offsets as negative delays (a head start), so the first frame is never blank.
A second animation is allowed only for a different property on the same clock, such as the
wave's shade track, which runs a whole number of loops.

### 21. Things that move together travel the same distance on the same curve

When two shapes move as one (the tree's base leaving as its top branch arrives), give them equal
distance, equal duration and the same easing; a 3px move beside a 4px one tears the illusion
apart halfway (Ethan).
Use `cubic-bezier(0.4, 0, 0.6, 1)` (a symmetric ease-in-out) for moves, and `linear` for fades
inside a loop.
Write the curve out in each keyframe: `animation-timing-function` in a keyframe ignores `var()`
and silently falls back to `ease`.

### 22. Scroll through the frame; clip, never shrink

A shape leaves or enters by sliding past the glyph's edge and being clipped (`overflow: hidden`),
the way film passes a camera gate; the icon's footprint never changes (Ethan).
Move only what is lit: a shape nobody can see does not need to travel, and resets while invisible.
Direction reads from asymmetry, not colour: a fast rise and a long fall show which way a light is
travelling (the orbit), a symmetric fade does not.

### 23. Glyphs are 12px and live on whole pixels

Status glyphs keep the icon's 12px box in every variant, so swapping one for another never shifts
the text beside it (derived).
Every edge, gap and offset is a whole CSS pixel: 1.5px gaps rendered as 2px and 1px on the same
glyph; 3px squares or pills with 1px gaps are the small-size grid.
Round a 3px shape by at most half a pixel, or it turns into a plus sign.

### 24. Reduced motion holds a still frame that still reads as busy

Under `prefers-reduced-motion: reduce`, loops stop and hold a half-lit frame (some shapes solid,
some at 0.55), never a blank or a spinner that looks broken (derived).
Feedback transitions drop to 0ms.
A status glyph is an `<output>` with an `aria-label`, so it is announced once, not on every frame.

### 25. Motion is judged frame by frame, and proved by measurement

Every motion ships with a Speeds story (the same loop at several durations, side by side) and is
checked on a contact sheet: the loop paused at even steps.
Timing claims ("half clipped as the branch is half faded", "no two squares share a shade") get a
browser test that seeks the animation and measures it; a screenshot of one good frame proves
little, since each frame of a broken loop can look fine on its own.

### 26. A panel slides back the way it slid out, and the rail's edge clips it

The projects panel's peek slides out from behind the rail's edge and back behind it on one curve
and one duration, 220ms both ways, and a pin or an unpin by the toggle moves on the same curve
over 250ms (Ethan). The curve is a fast acceleration into a long, smooth settle, fitted to the
value graph of Ethan's After Effects example: `cubic-bezier(0.17, 1.02, 0.58, 1)`,
`--panel-ease` in `index.css`. It covers half its travel by 13% of the time and 90% by 43%, and
the rest of the time is the settle.
The stage beside the rail clips the panel at the rail's edge (`overflow: clip`, never `hidden`,
so no focus or scroll into view can scroll it), the way rule 22's shapes pass their gate: the
panel never covers the rail's places, and the fade hides no motion (derived, ADR-144).
Out, it slides at full strength from the first frame, as a pin does, its edge's hairline and
shadow drawn at once (Ethan); a fade-in let the workspace's border show through it and drew the
panel's edge slowly. Back, it keeps full strength and fades over the slide's last 120ms,
starting 100ms in, on the strong ease-out played backwards (derived): still 0.97 when its edge
is 2px from home.
Its rows go first, as a title's type goes before its bar, on a peek's way back and on an unpin
alike: they fade from the first frame on the strong ease-out and are at 0 once the panel has
covered three quarters of its way home (60ms, the curve's 75% mark at 27% of the peek's 220ms),
so no row is left as the panel lands (Ethan). The paper and its edge stay solid, so the slide
still reads. Opening, the rows are there from the first frame.
A pin while the panel peeks moves only the workspace, sliding under the panel: the peek's edge
holds through it until the workspace's rounded border is under it (Ethan).
Docked by the toggle, the line that parts the rail from the panel is the rail's own right edge,
not the panel's left: it is there on the pin's first frame, the panel sliding out from behind
it, and it stays through an unpin until the panel is home (Ethan). A line on the panel's edge
would sit behind the clip until the last frame and creep in as the curve settles, like a fade.
That tail fade takes away only the soft shadow and the hairline across the workspace's corner,
which would otherwise vanish in one frame as the panel lands: 2.5% of the 40px strip past the
rail's edge in either theme, the landing frame at full strength against rest (derived).
The first way back faded on the slide's own front-loaded curve over 160ms: at 0.32 after 33ms,
with its edge still 83px out, it read as no motion at all.
The sidebar checks' P24 seeks both directions to the same instants, holds them to this and
measures that share; P29 and P30 hold the rail still, and its edge its own, at every such frame.

## Verification workbench exceptions

The Pixels workbench uses neon green (`#39ff14`) for changed pixels. Comparator proof uses red
(`#ff0000`) for its deliberately introduced mistakes (Ethan). These diagnostic colors are not
product status colors. Their roles live in `tools/verify-ui-drift/src/diff-palette.ts`; grayscale
supplies
unchanged context. Older evidence keeps its original overlay color rather than rewriting artifacts.

Workbench density uses five-sixths of `--space` for its primary spacing, about 17% less than the
24px token (derived from Ethan's request for roughly 15% more room). The viewer height is 17 times
`--space`, or 408px. Typography keeps the existing 12px annotations and 13px compact controls;
display sizes use 28px for the heading and 24px for the selected component. Image zoom and the 4×
inspector are not scaled with the surrounding interface (derived).
The Pixels results list displays up to ten complete rows before scrolling (Ethan). Its height
follows
the rendered rows so source-path wrapping and font changes do not hide entries (derived).

## Open questions

- Whether the stepped slider, dictation controls, links and the primary button should move from
  olive to ink, so green only appears on button hovers (tracked in `docs/LATER.md`).

- Rules 2 and 3 (and the display ink `#22251e`) rest on how the tint looked on a screen with a
  blue-light filter, which warms dark neutrals: re-check them with the filter off.
- Ethan's warm greys (`#8a8a85`, `#cbcac4`) were picked on the same screen: keep them as deliberate
  choices, or re-pick them with the filter off.
- Where the declared `#111411` near-black green is used (likely the hero background) and where the
  declared soft blue `#95aac8` appears.
