# Architecture Decision Records

Each record is 1-3 sentences.
Status is one of: Proposed, Accepted, Watch (decided for now, revisit as we learn), Superseded (by
ADR-N).
Newest records go at the bottom.

## ADR-001 - Focus on agent legibility

2026-09-24 - Accepted.
Of the three problems in the posting, we build the demo around making agent work legible.
It is the product's core promise, it shows timing, hierarchy, and progressive disclosure directly,
and it can be demoed with scripted data.

## ADR-002 - Treat Glass as inferred DNA for Kay

2026-09-24 - Superseded by ADR-078 (the docs are now read; see `docs/05-kay-stack-and-data.md`).
The Kay docs were unreachable from this environment, so Kay's vocabulary and surfaces come from
search snippets, with Ramp's Glass as the likely ancestor.
Anything inferred from Glass is labeled as inferred and must be checked against docs.meetkay.ai
before the interview.

## ADR-003 - The user's input never moves

2026-09-24 - Accepted.
The compose field keeps its size and position while typing, dictating, or streaming, and streamed
output never pushes the input down.
People proofread as they type, so layout shifts break their place.

## ADR-004 - Recognition over recall for skills

2026-09-24 - Superseded by ADR-009.
Typing `/` shows a filterable list of skills inline, and the chosen skill appears as a visible chip
before sending.
Users never need to memorize skill names or wait for "loading skill" to confirm.

## ADR-005 - Summaries are views over structured events

2026-09-24 - Proposed.
The agent records typed events (tool called, file changed, message sent), and every summary is
rendered from those events, with each line linking to its evidence.
We avoid a second model narrating the first after the fact, because that narration can drop or
invent details.

## ADR-006 - Outcomes first, steps second

2026-09-24 - Proposed.
Agent work is shown by what changed in the world (sent, changed, spent, waiting on you), with the
step-by-step trace one disclosure layer down.

## ADR-007 - Confirmation weight matches irreversibility

2026-09-24 - Superseded by ADR-010.
Reversible actions take a tap; irreversible ones use hold-to-confirm, with the hold getting longer
as the consequence grows.
The playful interaction doubles as a signal of how much the action matters.

## ADR-008 - Legible work becomes remixable work

2026-09-24 - Proposed.
A finished run renders as a reactive recipe (like marimo) where editing an upstream step re-runs the
steps after it, and any run can be saved as a skill.
This ties legibility to the success metric: users creating their own workflows and skills.

## ADR-009 - Skills match from plain language, confirmed as a chip

2026-09-24 - Accepted.
Typing plain words (e.g. "create watcher workflow") shows matching skills in a popup above the
input; Tab applies one, and Enter sends as typed unless the user arrowed into the popup.
The matched words become a chip inside the compose box (Backspace turns it back into text), so users
get natural language and visible confirmation without memorizing a `/` command, which remains an
optional power-user shortcut.
Principle: no special syntax to invoke a skill, but immediate confirmation that it is applied, so
the user is never left wondering what the agent will do with their message.

## ADR-010 - Tap to choose, hold to ship with your defaults

2026-09-24 - Accepted.
Tapping an action opens its options; pressing and holding skips the options and runs with the user's
saved defaults, which appear inside the fill bar as it fills (release early to cancel), and the fill
takes longer for actions that are harder to undo.
After the same choices repeat, the options panel suggests "hold to skip this next time", and hold
falls back to opening the panel when a default looks wrong for the current context.
This keeps full agency on tap and adds throughput on hold, modeled on Amp's hold-to-ship.

## ADR-011 - Documents autosave; agent edits are named versions

2026-09-24 - Accepted.
New documents and artifacts save automatically, with an auto-generated title in a predictable place,
matching the Google Docs habits of knowledge workers.
Every agent edit is recorded as an attributed, restorable version, and when the user is editing at
the same time, agent changes land as suggestions instead of overwriting their text.
This sets the product-wide line: changes inside Kay are automatic and reversible, while effects that
leave Kay (send, share, publish) are deliberate (ADR-010).

## ADR-012 - Pin to lock what you like

2026-09-24 - Accepted.
Users can pin a whole document or a single section (pin icon appears in the margin on hover), and
the agent treats pinned text as locked: it never rewrites it and says when it left pinned text
alone.
Unpinned text may be edited directly and restored from version history (ADR-011); pinned text only
ever receives suggestions.

## ADR-013 - Agent edits are reviewed as a redline

2026-09-24 - Proposed.
Proposed changes render as a redline, with strikethrough for removed text and a non-formatting
marker (underline or highlight tint, not bold) for added text, so the signal never depends on
red/green or collides with real formatting.
Each change is accepted or rejected individually from a review panel; on accept, struck text
collapses away (~200ms) and the new text settles to normal styling.
Open: inline redline plus a review-list panel, versus a side-by-side compose panel; prototype both.

## ADR-014 - Charts are tested catalog components; the LLM only describes data

2026-09-24 - Accepted.
Each chart type (`LineChart`, `BarChart`, and so on) is built and tested once as a Kay catalog
component, and the LLM only emits a validated data description (series, fields, a small set of
deliberate options such as reference lines), never new chart code.
Requests outside the catalog get an honest fallback ("I can show this as a table") instead of
improvised UI.
The engine is Recharts (mature, shadcn's default) hidden behind the catalog, so switching to
TanStack Charts later touches only the catalog.

## ADR-015 - Catalog components vary by options, split by purpose

2026-09-25 - Accepted.
Variations such as reference lines, stacking, and annotations are optional, individually tested
props on one component (e.g. `LineChart`), which the LLM fills as data and never as nested JSX,
because props compose while variant components multiply.
A new component is justified only when the purpose or data shape changes (e.g. `Sparkline` inline in
text, or `BudgetVsActual`).

## ADR-016 - Watch the catalog's long tail

2026-09-25 - Watch.
The line between "an option on an existing component" and "outside the catalog" will keep moving as
users ask for things we did not predict.
Every out-of-catalog fallback is logged with what was asked, and recurring requests are promoted to
new options or components, so the catalog grows from real demand; revisit the fallback rate and the
option budget per component regularly.

## ADR-017 - Kay suggests skills from repeated patterns

2026-09-25 - Accepted.
When a user repeats a similar request, Kay suggests turning it into a skill, but only at a natural
pause after a run completes, showing the evidence ("asked 3 times: Mon, Wed, today") and opening the
draft as an editable recipe (ADR-008) before anything is saved.
Suggestions offer "Not now" and "Don't suggest this" and are frequency-capped; this is ADR-016's
feedback loop at the scale of one user, inspired by Hermes agent.

## ADR-018 - "Previously on": a recap when the user returns

2026-09-25 - Superseded by ADR-027.
After time away (time since last input plus the window losing and regaining focus), a short
outcomes-first recap of the last runs appears above the compose box, rendered from recorded events
with links to evidence (ADR-005/006), inspired by Amp.
It overlays the conversation without moving the input (ADR-003) and collapses into a "Recap" chip as
soon as the user types.

## ADR-019 - A pop-out Kay for work across threads

2026-09-25 - Accepted.
A pop-out chat outside the thread list, summoned anywhere by a global shortcut, handles side
questions, status across threads and projects, and orchestration, inspired by Amp's Puck.
Threads are for doing a piece of work and the pop-out is for talking about your work; when a side
question becomes real work, it is handed off to a new thread visibly, and the user-facing name
avoids the word "orchestrator".

## ADR-020 - Edit and Remix open a linked new thread

2026-09-25 - Accepted.
Refining a skill or a chart/table starts a new thread so the original flow stays clean.
Both threads link to each other ("Remixed from" / "Remixed to"), and finishing the remix offers "Use
this in the original", which updates it as a named version (ADR-011), so forks never become orphans.

## ADR-021 - User messages are high-contrast landmarks

2026-09-25 - Superseded by ADR-025.
The user's messages render as contained cards with a distinct fill and weight (contrast without loud
colour), so they work as chapter headings when scrolling back.
While scrolling through a long answer, the question it answers stays pinned at the top of the
thread.

## ADR-022 - The scrollbar is a map of the conversation

2026-09-25 - Accepted.
Each turn is a marker on the scrollbar; hover shows the request and a turn summary built from
recorded events (ADR-005), and clicking jumps so the user's message lands vertically centered every
time (eye trace), inspired by Zed's Delta.
Markers are coloured by kind (user message, outcome, waiting on you), have generous hit targets, and
support bookmarking.

## ADR-023 - Catalog cards size to their panel, not the screen

2026-09-25 - Accepted.
Catalog components live inside a chat thread whose width depends on split panes, so they use
container queries with three densities: compact (under ~480px), standard (~480-720px), and expanded
(opened in the side pane).
Inside a thread, cards drop page-level framing (no repeated question, no large headings), offer
"Open in pane" for exploration, and reserve their final height before rendering so the conversation
never jumps (ADR-003).

## ADR-024 - Strict single-card selection before A2UI

2026-09-25 - Accepted.
The agent selects exactly one catalog card with required and optional props and a meaning-bearing
variant; one invented field rejects the whole card.
This answers "can the goal be reached without A2UI?" with yes, and makes every failure loud and
specific, which speeds up iteration; A2UI-style component trees and streaming stay out until a real
need appears.

## ADR-025 - User messages rest on the thread as tinted bubbles

2026-09-25 - Accepted.
The thread background stays dominant; the user's message is a soft tinted surface on top of it,
right-aligned at up to 85% width with a hairline border and the time below, so it is recognised as
"you" by shape and position rather than heavy contrast.
A full-width dark treatment was tried and read as a section header; findability when scrolling back
comes from the scrollbar map (ADR-022), and the question being answered still stays pinned at the
top while scrolling a long answer.

## ADR-026 - One compose box everywhere: attach left, dictate and send right

2026-09-25 - Accepted.
Every chat compose field is the shared `ComposeBox`: a paperclip attach button on the far left, and
a microphone for dictation directly left of the send button.
It floats directly under the conversation with no divider line above it, and keeps a fixed height so
typing never moves it (ADR-003).

## ADR-027 - Recap after ten idle minutes on an active thread

2026-09-25 - Accepted; "Needs you" items moved out by ADR-039.
When a thread is still active and the user has sent nothing for 10 minutes or more, a recap of
recorded outcomes appears above the compose box, "Needs you" items first, each jumping to its
evidence turn (ADR-005/006, ADR-022), inspired by Amp's recap.
It overlays the conversation without moving the input, collapses to a chip while the user types,
stays dismissed for the current idle stretch, and uses no decorative ribbon or badge.

## ADR-028 - Dictation takes over the thread as a modal

2026-09-25 - Accepted.
Tapping the mic opens a modal over the thread with a dimmed backdrop and a disabled compose box,
which tells non-technical users plainly that typing is paused while recording.
Its large waveform works like a DAW with the playhead locked to the center: new audio enters at the
playhead and scrolls right to left, with a dotted line for the empty timeline ahead (after Amp's
waveform); a live transcript preview, a microphone picker, Esc to cancel, and Enter or Done to
insert complete it.

## ADR-029 - Interactive cards react in the runtime, never through the model

2026-09-25 - Accepted.
Catalog cards may carry controls (switch, stepped slider, numeric slider) bound to precomputed data
and to live text templates, and Kay's runtime updates the chart and the agent's sentence instantly
on every change, with no model call per interaction (after marimo's reactive elements).
Controls must fit the data (sliders need a numeric range or labeled stops; two meanings become a
switch), the agent says when it translated a request into a different control, and a "Show recipe"
view reveals the steps whose controls become skill settings (ADR-008, ADR-017).

## ADR-030 - Every interactive surface reports its state back

2026-09-25 - Accepted.
When the user changes an interactive card or custom view, its current state attaches to their next
message as a visible, removable chip (e.g. "Net profit · Sep 14-20"), so the agent answers about
what the user is actually looking at.
This applies to catalog cards and to model-written custom views alike (the typed export is the
contract, after the "copy as JSON" pattern in Thariq Shihipar's HTML article), and it follows
ADR-009: no hidden context, and the user always sees what the agent will act on.

## ADR-031 - Interaction is conversation: the user's choices feed the agent

2026-09-25 - Accepted.
Meaningful choices the user makes in any interactive surface (card controls, accepting or rejecting
redline changes, pins, sorting on a bucket board) are fed back to the agent as structured, visible
input, so the chat becomes a live feedback loop where the user steers by doing, not only by writing.
This keeps users engaged and playing instead of checking out while reading walls of text, which
serves the goal of turning them into creators; only meaningful choices count (no hovers or scrolls,
and only a card's latest state), and every choice travels as a visible, removable chip (ADR-009,
ADR-030).

## ADR-032 - Two tiers of interactive surfaces

2026-09-25 - Accepted.
Tier 1 is catalog cards, static or interactive: Kay's catalog builds them, the agent only describes
data, controls, and live text, and everything invented is rejected (ADR-024, ADR-029); tier 2 is
custom views, model-written HTML (after Thariq Shihipar's HTML article) for throwaway personal
tools, sandboxed, styled with Kay's tokens, and visibly labeled as custom.
Both tiers return the user's choices to the agent through the same visible chip (ADR-030, ADR-031),
and custom views that keep recurring are promoted into tier 1 (ADR-016).
Addendum: [04-interactive-surfaces.md](../04-interactive-surfaces.md).

## ADR-033 - Brand type: Inter for the interface, Newsreader for display

2026-09-25 - Accepted.
Following yaklabs.ai's computed styles, Inter is the interface and body face and Newsreader the
display face (headlines, wordmark, thread titles), exposed as `--font-text` and `--font-display`
tokens with the site's fallback stacks.
Both are SIL Open Font License fonts bundled from @fontsource with optical sizing, so the desktop
app renders them offline; commercial fonts would never be committed, only referenced by name with a
free fallback.

## ADR-034 - Brand colour: sampled palette, semantic tokens, one derived green

2026-09-25 - Accepted.
The palette comes from yaklabs.ai's declared CSS: off-white `#f0efea`, ink `#252524`, body copy as a
solid `#4a4a47` (about 82% of the ink), a 0.72 ink step for meta text and borders (used here as a
solid tint), and the declared sage `#c7cfba` for soft tints; hero-photo greens come from Ethan's
Figma picks. (An earlier pixel-sampled pass read body copy as ink at 74% opacity; the CSS showed a
solid grey.)
Components use only semantic tokens (`--text-body`, `--line`, `--accent`, `--accent-soft`, and so
on), and the UI accent is an olive `#515e38` derived on the declared sage's hue (OKLCH 124°),
chosen over a forest-hue green so that buttons, charts, chips, and bubbles share one hue; it passes
6.1:1 on paper and under cream text.

## ADR-035 - Outline button after yaklabs.ai, as a starting point

2026-09-25 - Accepted.
The default text button copies the site's "Apply for this role" button from its computed styles:
14px medium Inter, 10px × 22px padding, 4px corners, and an ink outline at 0.72 at rest, with the
fill (forest `#242b24`, measured from a hover recording) and off-white text arriving over a 150ms
`ease` transition on hover; the border does not animate.
The site has no delay: the "beat" before the fill is the 150ms duration itself; duration, delay,
easing, and colours stay tokens (`--btn-*`) as Ethan's starting point for design iteration.

## ADR-036 - "Show my work", always collapsed by default

2026-09-25 - Accepted.
The toggle that reveals how an answer was produced is labelled "Show my work" (not "Show recipe",
which is builder jargon), and it always starts collapsed, on every card, in every context.
Kay's job is to earn enough trust that non-technical users never need to check the steps; the steps
stay one click away for anyone who wants them, and are still the source for skill settings (ADR-008,
ADR-017, ADR-029).

## ADR-037 - Anything that expands in the thread lands centered, never under the compose box

2026-09-25 - Superseded by ADR-038.
When a card, accordion, or menu inside the thread expands, the thread scrolls so the newly shown
content (with the control that toggles it) is fully visible and vertically centered in the visible
band above the compose box and any recap overlay; content taller than the band starts at its top,
and at the end of the thread it rests flush above the compose box rather than leaving an empty gap.
The thread owns this one rule and components opt in through a `reveal` hook, and jumping to a turn
uses the same calculation (ADR-022), so expanding and jumping always frame content the same way.

## ADR-038 - An expanded card rests 20px above the compose box, like the last card

2026-09-25 - Accepted.
When a card inside the thread would be clipped by the compose box (or by the card docked above it),
the thread scrolls just enough for the card's bottom to rest 20px above it, exactly where the last
card in the thread rests; a card that already fits does not move, one taller than the view starts at
its top, and the thread never scrolls up to reveal, because that would move away from the click.
The thread panel enforces this for every component by watching each turn grow right after a click or
key press inside it, so no component has to opt in; jump-to-turn still centers its target (ADR-022),
because a jump is navigation, not an expansion.

## ADR-039 - "Needs you": a question the agent waits on, separate from the recap

2026-09-25 - Accepted.
When the agent is blocked on the user, it emits a validated question (zod, fails closed) that floats
above the compose box as a "Needs you" card with numbered choices after Claude Code's question
prompt: the agent's branches, one concrete question answered by typing right in the card, and a way
out that the agent may word for the moment ("Chat about a plan to ...") and the host otherwise fills
with "Chat about something else", with keys 1 to N and no close button.
Each row asks something different, so the card never asks "what do you want to talk about?" twice.
Every text is at most two short sentences (120 characters, about three lines in the narrow card),
labels fit one line, and the typed-answer prompt fits its one-line field; a longer question means
the agent needs more context, so it asks in the thread instead (ADR-040).
The recap only reports what happened and never asks for anything, and the question shows as soon as
the agent is blocked rather than after idle time, because being blocked is not an idle state; while
a question is open, it takes the recap's place.

## ADR-040 - A malformed question goes back to the agent, never to the user

2026-09-25 - Accepted.
A question that fails the schema never becomes a card, not even part of one, and the user never sees
the error: the validation error goes back to the agent, which asks for what it needs in an ordinary
streamed reply, so a blocked agent is never silently stuck.
A bad question (irrelevant, or offering a path that makes no sense) should never be asked at all,
which is the model's and the prompt's job; the schema only guards shape, and generation should be
constrained to the same schema so a malformed one is rare.

## ADR-041 - One seam between the thread and whatever answers it

2026-09-25 - Accepted.
The thread only reports events to an `Agent` (the user sent a message, answered a question, or the
agent's question was rejected) and renders the reply that streams back as text chunks; it never
decides what the agent says.
The scripted lab stand-in (`labAgent.ts`) is the only fake left and is the default, so showing the
UI with a real model means passing another `Agent`, with the question schema shared between that
runtime and the UI (ADR-040).

## ADR-042 - What needs attention sits on a strong surface

2026-09-25 - Accepted.
The recap and the "Needs you" card use a warm grey, `#62625d` (Ethan's pick), so they stand apart
from every card in the thread, which all sit on the light paper; their text flips to cream (5.6:1),
with muted text at 90% cream (4.9:1) and a hover that darkens to `#3d423b` (Ethan's pick, the
palette's sage) rather than lightening, so text stays well above 4.5:1 (cream 9.4:1); light surfaces
keep their own lighter hover.
It is the lightest grey in its family where cream text still passes: `#51534b` felt jarring, and
`#8a8a85` failed with light text (3.2:1) and looked disabled with dark text.
The cards redefine the text tokens locally instead of carrying colours of their own, and the olive
send key inverts to cream because olive disappears on the grey.

## ADR-043 - A text field primitive with the button's outline

2026-09-25 - Accepted.
Places to type use one shared `.field` class with the outline button's 1px border and 4px corners
(ADR-035), so a field reads as part of the same family; surfaces tune it through `--field-*` tokens,
and the strong surface is a reusable `.surface-strong` class rather than per-component colours.
In the "Needs you" card, the typed answer uses it, with a placeholder greyer than the statements in
rows 1 and 3 so a question to answer is not mistaken for a choice; a faint recessed fill keeps that
greyer placeholder at 4.6:1, and the send key sits inside the field's right edge and takes room only
once there is text.

## ADR-044 - Focus is a warm mid grey

2026-09-25 - Accepted.
The focus ring, the compose box's focused border, and the focus glow use `#8a8a85` (Ethan's pick),
which clears the 3:1 a ring needs on the page (3.0:1) and on cards (3.3:1), replacing the olive
accent; the darkest hero green `#161d17` was tried first and read too heavy.
On the strong surface the grey is 1.8:1, so that surface keeps a cream ring (5.6:1), drawn inside
tiles so it sits against the tile.

## ADR-045 - "Needs you" is numbered tiles with Skip and Submit, and it folds

2026-09-25 - Accepted.
Choices are tiles a shade deeper than the card (separated by fill, not outlines), each with its
number on the left: the number's outline appears on hover and fills solid when selected, and
choosing is two steps, select (click, number key, arrows) then send (Enter or Submit), with Skip
beside Submit at the bottom right, after Claude's and Amp's question prompts.
The card stays dark so it catches the eye while the app waits on the user, and its header folds it
to one line (label, question, chevron), after Amp, so the user can read back through the thread
without dismissing the question.

## ADR-046 - Attention surfaces in light and dark mode

2026-09-25 - Accepted.
In light mode, the current mode, the recap and "Needs you" sit on a mid grey `#8a8a85` with the
darkest ink `#111411` (5.4:1, since the regular ink is 4.4:1 there), and choices are tiles of
`#cbcac4`, darker than the user's bubbles, with dark text (9.3:1); hovers lighten, as on every light
surface.
The dark card tried in light mode (`#62625d`, cream text, deeper tiles, sage hovers) is kept as dark
mode under `:root[data-theme="dark"]`, switchable from Storybook's toolbar; only the attention
surfaces are themed so far.

## ADR-047 - The sage tint means "you", and nothing else

2026-09-25 - Accepted.
The sage-green tint of the user's bubble is reserved for that bubble, so the colour always means
"this is what you said"; context chips, badges and tags use the neutral wash instead.
The tokens are named `--bubble-*` so the tint cannot be reused elsewhere by accident.

## ADR-048 - The app surface is the site's own background

2026-09-25 - Accepted.
The app's surface (the thread panel, its cards, and the compose box) uses `#f0efea`, yaklabs.ai's
page background, and the window around the app takes the lighter step it used to have (`#f8f8f6`),
so Kay reads as the same material as the website.
Text contrast is now measured against `#f0efea`, the darker of the two; everything still passes,
with the grey focus ring the closest at 3.0:1.

## ADR-049 - Adopt yaklabs.ai's token names and contrast pattern

2026-09-25 - Accepted.
The core tokens now use the site's own names and values, read from its stylesheet: `--paper`,
`--paper-deep`, `--ink`, `--soft-ink`, `--rule` (ink at 72%), `--hairline` (ink at 25%), `--blue`,
`--sage`, `--chalk`, `--moss`, `--rust`; colours the site does not declare keep a `--yak-` prefix so
their origin stays visible.
The contrast pattern follows the site too: two text inks (headings `--ink`, everything else
`--soft-ink`), two line weights (`--rule` for outlines, `--hairline` for borders), `--paper-deep`
for hover and inset fills, and `--blue` text selection; this retires our `--muted`, `--line`,
`--wash`, and `--text-body`, and corrects `--rule`, which we had at 21%.

## ADR-050 - Where yaklabs.ai and meetkay.ai differ, Kay's own site wins

2026-09-25 - Accepted.
The Design Engineer posting lives on meetkay.ai, Kay's product site, whose stylesheet declares the
same token names with some different values; since Kay is the product, its values win.
`--soft-ink` becomes meetkay.ai's `#5c5c57` (5.8:1 on paper) instead of yaklabs.ai's `#4a4a47`, so
body and secondary text sit visibly one step lighter than headings, as on the posting; meetkay.ai
also declares `--moss: #1d291f` (its filled submit button) and `--error: #9c3b2a`, not yet adopted.

## ADR-051 - Brand colours come only from declared CSS, never from pixels

2026-09-25 - Accepted.
The screen used to sample colours had a blue-light filter, so every colour picked from screenshots
or recordings as a brand fact is dropped: the hero-photo greens and cream and the measured button
hover fill `#242b24`; this amends ADR-034, ADR-035 and ADR-046.
The button hover uses the declared near-black green `#111411` until the site's hover rule is read
from its stylesheet, text on dark fills uses the declared paper `#f0efea`, darker greens are mixed
from declared values, and Ethan's warm greys stay as deliberate picks, flagged for a re-check with
the filter off.

## ADR-052 - The button's hover is the site's moss, read from its stylesheet

2026-09-25 - Accepted.
yaklabs.ai's rule is `.apply-jump:hover { background: var(--moss); border-color: var(--moss); color:
var(--paper) }`, so the outline button now fills with `--moss` `#263b30` (paper text 10.4:1), and
its border turns moss too, instantly, since only the fill and text colour are transitioned; this
replaces the provisional `#111411` from ADR-051 and the measured `#242b24` from ADR-035.
The button follows yaklabs.ai's `--moss`, not meetkay.ai's `#1d291f` (ADR-050), because it copies
that site's button; which moss the product uses elsewhere stays open.

## ADR-053 - The focus ring is for keyboard and assistive focus only

2026-09-25 - Accepted.
Browsers treat every focused text field as keyboard-focused, even after a click, so `:focus-visible`
rang a clicked field; `inputModality.ts` now records whether focus last came from Tab or a pointer
(`<html data-input>`), and a clicked field or compose box keeps its focused border without the ring.
Tab and assistive tools (no pointer yet) still get the ring.

## ADR-054 - The attention surface: pale card, paper tiles, dark hover

2026-09-25 - Accepted; amends ADR-046.
"Strong surface" is renamed the attention surface (`.attention-surface`, `--attention-*`); in light
mode the Recap and Needs you cards are `#d6d5cf` with ink text, rows hover to `#8a8a85` with their
text switched to `#111411` (the usual inks fail there), tiles are paper (the old `#cbcac4` was 1.1:1
against the new card), the focus ring inside is ink, and Submit fills with moss on hover.

## ADR-055 - Bars are flat

2026-09-25 - Accepted; supersedes design pillars 10 and 11.
The eased darker base on chart bars did not work with the colour scheme, so bars are one flat data
colour with 4px top corners; the bar colour itself is being chosen, and green is reserved for button
hovers.

## ADR-056 - The compose box is brighter than the app

2026-09-25 - Accepted.
The compose box uses `#f8f8f6` (`--compose-bg`), one step brighter than the app's paper, so the
place to type reads as the nearest, most active surface; the window around the app uses the same
colour.

## ADR-057 - Secondary text comes from the site's brand.css

2026-09-25 - Accepted; amends ADR-050 for this token.
yaklabs.ai loads a shared stylesheet, `/brand.css`, whose `--soft-ink` is `#565650`, while its pages
override it (`#4a4a47` inline on the homepage, `#5c5c57` on meetkay.ai's careers page); secondary
text adopts the brand file's value (6.4:1 on paper).
Only this token changed; the brand file's other small differences (`--hairline` at 24%, no `--rust`)
are left as they are.

## ADR-058 - Chart marks are neutral graphite

2026-09-25 - Accepted; completes ADR-055.
Bars, lines and legend keys use `#56564f` (`--yak-graphite`, Ethan's pick; 6.4:1 on paper), so green
stays reserved for button hovers; `#252525` read as black and `#c7cfba` failed the 3:1 a chart mark
needs and belongs to the user's bubble.
The stepped slider stays olive for now, pending a decision on moving it to ink.

## ADR-059 - Needs you parts from the Recap: paper card, grey pills, a header line

2026-09-25 - Accepted; amends ADR-054 for Needs you.
The Recap is done and keeps the pale attention card; Needs you now sits on the app's paper with its
option pills in the attention grey `#d6d5cf` (hover still `#8a8a85`), and a line under its header
marks the header as the fold control, with 8px between the header's hover fill and the line; folded,
there is no line.
Neither card shows a shadow on its top edge any more; the lift shows only below.

## ADR-060 - Needs you options rest on paper-deep and hover to the attention grey

2026-09-25 - Accepted; amends ADR-059.
Needs you option pills rest on brand.css's `--paper-deep` (`#e4e4df`, one step below the card's
paper) and hover to `#d6d5cf`, which is light enough that labels and details keep their usual inks
(10.4:1 and 5.0:1); the header and Skip share that hover, and the Recap keeps its `#8a8a85` hover.

## ADR-061 - Submit announces readiness with motion, and fills only on hover

2026-09-25 - Accepted.
Once a choice is made, Submit stays an outline: a second outline fades in from 8px outside and
closes onto the border in 450ms, its stroke thinning from 6px to 4px and then to 1px in the last
frames, and then it disappears, handing off to the real border so two outlines never overlap, so
becoming available is a motion rather than a colour, and the moss fill is left for hover alone;
before, a filled Submit and its moss hover were nearly the same.
It is CSS only (a pseudo-element created when `:disabled` stops matching starts the animation),
drawn as an inset shadow because border widths snap to whole pixels; under reduced motion the
outline simply appears.

## ADR-062 - Five primitives under every surface

2026-09-25 - Accepted.
Disclosure (accordion), Menu (popover), Modal, CardHeader and IconButton are shared primitives with
their own Foundations stories, so every surface builds from the same parts: the Needs you fold is a
Disclosure, dictation is a Modal, the compose attach and card share menus are Menus, and every
card's top is a CardHeader with a flush divider.
The Menu is fixed to the viewport beside its trigger and closes on scroll or resize, because the
compose row and cards clip their overflow and would otherwise cut it off.

## ADR-063 - Attach files or a screenshot from the compose box

2026-09-25 - Accepted.
The paperclip opens a menu with "Add images & files" (⌘U) and "Take screenshot"; the screenshot
uses the browser's screen-capture prompt (the user picks what is shared), grabs one frame and stops,
and attachments ride along with the next message as chips, which can be sent on their own.
The goal is less friction in the feedback loop: showing the agent what you see should take one
click, because non-technical people get better results, and enjoy the work more, when showing is
easier than describing.

## ADR-064 - Share one card as a public page

2026-09-25 - Accepted.
Every card has a share button that copies a link to, or opens, a standalone page showing only that
component, never the conversation; the card travels in the link's fragment (which never reaches a
server) and passes the same catalog check before rendering, so a garbled or edited link shows an
honest notice, and interactive cards stay interactive.
In the lab the page is `share.html` beside the app, or the Share/Public page story inside Storybook;
making it public means deploying either one.


## ADR-065 - Contrast is measured before a colour ships

2026-09-26 - Accepted.
Every colour change is checked in numbers, not by eye: text needs at least 4.5:1, and UI parts and
graphics (rings, outlines, chart marks) at least 3:1, measured against every surface the colour
touches, including hover, selected and dark mode; a requested colour that fails is flagged with its
ratio, and the nearest passing option, before it ships.
Colours that looked fine failed on measurement at least six times: `#8a8a85` with light text (3.2:1,
ADR-042), the grey focus ring on the attention card (1.8:1, ADR-044), the regular ink on the
`#8a8a85` hover (4.4:1, ADR-046), sage as a chart mark (ADR-058), and olive (2.0:1) and soft ink
(2.1:1) on that same hover; taste proposes, numbers dispose.

## ADR-066 - One writer per branch

2026-09-26 - Accepted.
Parallel sessions may read a branch freely, but only one writes to it at a time, and write ownership
passes explicitly, in a handoff that names the branch, its head commit and the open PR, so the new
writer starts by checking the repo against it.
Two sessions once pushed to the same branch and collided; read-only helpers such as the Figma token
watcher never push, so they need no handoff.

## ADR-067 - The question card is labelled "Needs attention" and fills only on hover

2026-09-26 - Accepted; amends ADR-059 and ADR-060.
The label reads "Needs attention" on a yak brown pill (`#d0ae7e`) with near-black brown text
(`#3b2612`, 6.8:1), both Ethan's picks, replacing the faint warn colours.
The card has no grey fill at rest: option pills lose their `--paper-deep` rest fill and take it as
their hover instead (ink 12.0:1, soft-ink 5.8:1), the `#d6d5cf` hover is gone from this card (the
Recap keeps it as its surface), and the header and Skip share the new hover; dark mode is unchanged.

## ADR-068 - The Needs attention pill is caution orange

2026-09-26 - Accepted; amends ADR-067.
The label's fill moves from yak brown `#d0ae7e` to an orange `#d19456` (`--yak-orange`, Ethan's
pick) so it reads as caution, not decoration, while the text stays `#3b2612` (5.5:1 on the new
fill).

## ADR-069 - Attention cards cast their shadow down and to the right

2026-09-26 - Accepted; amends ADR-059.
The Recap and Needs attention cards' shadow moves 8px right as well as 8px down (`8px 8px 16px
-8px`), so it shows equally on the bottom and right edges and not at all on the top or left, as if
lit from the top left; before, the right side was barely darker than the surface (5 levels against
19 at the bottom), so the card looked lifted only at its bottom edge.

## ADR-070 - The control you just clicked stays in view

2026-09-26 - Superseded by ADR-071.
When a click makes a card taller than the visible thread, the thread still starts the card at its
top, unless that would leave the clicked control under the compose box; then it scrolls until the
control rests 20px above the compose box, so a toggle such as "Show my work" can always be clicked
again to hide.
Before, opening the profit card's steps pushed "Hide my work" beneath the compose box, where a click
landed in the text field.

## ADR-071 - An expanded card always shows its bottom edge

2026-09-26 - Accepted; supersedes ADR-070 and amends ADR-038.
When a click grows a card and its bottom is clipped by any surface (the compose box, or the Recap or
Needs attention card docked over the thread), the thread scrolls up until the card's bottom edge
rests 20px above that surface, even if the card's top leaves the view; a card that is not clipped
does not move.
The bottom edge is the signal that everything in the card has been shown: without it, a
non-technical person is left wondering how to close the card, or waiting for the agent to say more.

## ADR-072 - Card footers are laid out in whole pixels, and toggles never change width

2026-09-26 - Accepted.
Every card toggle ("Show my work" / "Hide my work", "View data table" / "Show chart") is 128px wide,
which fits the widest label, so the button stays put when its label flips; before, it moved 6px (and
1.7px on catalog cards).
The source line and the button share a 17px line, so the 52px footer places the text exactly 7px
inside the 31px button, and both snap to the same pixel rows at any scroll position; before,
fractional sizes (a 16.5px text line, a 30.89px button) let a browser round the text a pixel
differently between the open and closed card.

## ADR-073 - Show my work's steps are whole pixels tall

2026-09-26 - Accepted; completes ADR-072.
The steps use a 20px line instead of 1.7 (20.4px), so the list is a whole number of pixels tall
(140px for six steps); the reveal scroll moves in whole pixels, so the footer now lands exactly
where it started (625.58px before opening and after), where the 154.34px list left it 0.34px lower
and could round the whole footer down a row.
Toggling also re-renders the card's chart, which redraws its bars without moving a pixel; memoizing
it is logged in `docs/LATER.md`.

## ADR-074 - Kay's architecture, as published

2026-09-26 - Watch.
From YakLabs' own pages (job posts, DPA, Data Use, Privacy Policy; details and sources in
`docs/05-kay-stack-and-data.md`): one TypeScript monorepo holds a React desktop app, a local daemon,
cloud services and plugins; the cloud is an API and an inference gateway on Fly.io with managed
Postgres, Cloudflare at the edge, and WorkOS for sign-in, and conversations, files and credentials
never leave the user's device.
The desktop shell is probably Electron but unconfirmed, and Rust or Go appears only as a
nice-to-have for the harness role; revisit if the interview says otherwise.

## ADR-075 - The slice keeps conversations on the device

2026-09-26 - Proposed.
Kay's DPA makes on-device storage "the primary control": conversations, files, notes and credentials
stay local, and hosted prompts pass through a gateway that writes nothing down, so the slice stores
conversations in the browser (see ADR-081) and sends to the cloud only what Kay's cloud holds (usage
metadata without content).
This rules out backends that persist message history by default, such as Convex's agent component
(`@convex-dev/agent`) and its persistent text streaming helper, unless storage is turned off.

## ADR-076 - The slice mirrors Kay's process split

2026-09-26 - Proposed.
The chat UI never runs the agent loop: a Web Worker stands in for Kay's daemon (the loop, the tools,
the local conversation store), talking to the UI only through messages across the `Agent` seam, and
a separate gateway holds the model key and streams replies.
Moving to Kay would then mean replacing the worker with their daemon and our gateway with theirs,
with no change to the UI; the honest limit is that a browser tab cannot run while closed or reach
the file system and shell, which is what makes Kay's daemon proactive.

## ADR-077 - The slice's backend is a small standalone service, not router-attached server functions

2026-09-26 - Accepted (Ethan): the service is Hono on Cloudflare Workers (ADR-085).
Kay's backend is separate services that the desktop app calls over HTTPS, and an Electron app has no
web server to attach server functions to, so Next.js App Router server functions are the wrong
shape; the closest match is a standalone TypeScript service (for example Hono) with Postgres, which
deploys to Fly.io or Cloudflare Workers (Kay's own hosts), so no other host such as Railway is
needed.
Convex is the fast alternative: it can host the whole runtime (its actions run up to 10 minutes, and
`@convex-dev/workflow` handles longer work), but its document-relational model differs from Kay's
Postgres rows, its agent component stores message history by default (see ADR-075), and running the
loop on a server moves it off the user's machine, the opposite of Kay; if chosen, use it fully and
keep it behind the `Agent` seam and a usage interface.

## ADR-078 - Shape the slice as a Kay plugin

2026-09-26 - Proposed; amends ADR-002 and ADR-074.
Kay's docs (docs.meetkay.ai, now reachable, so ADR-002's reliance on Glass as a stand-in is no
longer needed) say Kay is "a small stable core plus a set of extensions", where first-party
integrations are plugins that contribute tools, integrations, `scheme://` resources, bundled skills
and Pages ("full React apps hosted inside Kay's workspace"), and Kay runs on macOS only today.
So the slice is packaged the way a plugin would be: the catalog cards as a Page, the catalog as
tools the agent calls, and the card rules as a bundled `SKILL.md`, which makes "how would this ship
in Kay?" a one-sentence answer; the private plugin SDK is out of reach, so this mirrors the
contract's shape rather than using it.

## ADR-079 - Voice first: Kay can read its last reply aloud

2026-09-26 - Proposed.
Kay's quickstart promises "Download it, sign in, and start talking", so the slice doubles down on
voice: dictation already exists (ADR-028), and now, when a reply finishes streaming, a small
semi-transparent hint appears above the compose box, "Press ⌘T to hear me" (T for talk; Ctrl+T on
Windows), clickable as well as keyboard-driven, which reads back only the last completed reply (for
a card, its one-sentence summary); a speaker button in the compose area does the same, instead of
one under every message.
The hint is a non-blocking toast, not a modal, so it never takes focus from typing, and it goes away
when the user types or after a few seconds; ⌘T is free inside Kay's desktop app, but browsers keep
it for a new tab and never pass it to the page, so the web slice uses ⌘⇧H ("hear"; Ctrl+Shift+H
on Windows), which Chromium leaves to the page, and the hint shows whichever key works where it
runs; speech goes through the gateway with the ElevenLabs key held server-side and nothing stored,
with the browser's built-in voice as an on-device fallback, and the hint's text must pass 4.5:1
against the thread behind it (ADR-065).

## ADR-080 - The slice's gateway can be Kay's own: Bifrost

2026-09-26 - Watch: deferred by ADR-085; Bifrost can sit behind the Hono gateway later without
changing the browser side.
Kay's Data Use page names its inference gateway: "It runs Bifrost, open-source software we self-host
on Fly.io", an LLM gateway written in Go with one OpenAI-compatible API across providers; running
the same image on Fly.io (`fly deploy --image docker.io/maximhq/bifrost:latest`, configured from
`config.json`) makes the slice's gateway the same software on the same host as Kay's.
Bifrost's docs settle the three open questions: Anthropic chat streams, and ElevenLabs is supported
for speech output (streamed) and for transcription (not streamed), while Deepgram is not a provider;
browser access is set by `allowed_origins` (default `*`, so it must be narrowed); and
`enforce_auth_on_inference` with virtual keys, each with a budget and a rate limit, keeps the
provider keys on the gateway, though a key used from the browser is visible in the page, so its
budget must be small; the dashboard needs its password and setup token before the app is public.
Its content settings mirror Kay's DPA almost word for word: `disable_content_logging: true` keeps
metadata only, and `allow_per_request_content_storage_override: false` means no request can opt back
into storage.

## ADR-081 - The slice stores its data in SQLite, in the browser's private file system

2026-09-26 - Accepted (Ethan); completes ADR-075.
Conversations are saved as markdown files and indexed in SQLite (the official WebAssembly build,
`@sqlite.org/sqlite-wasm`), both kept in the Origin Private File System (OPFS), a folder the browser
gives only this site; that mirrors Kay's local storage (transcripts as markdown, a local database of
text and vectors) and its promise that conversations never leave the device, and it removes any
hosted database from the slice.
SQLite's fast OPFS mode works only inside a Web Worker, so the worker that stands in for Kay's
daemon (ADR-076) owns the database; the page asks the browser to keep the data
(`navigator.storage.persist()`), and clearing site data still wipes it, as deleting Kay's
application data folder would.

## ADR-082 - New UI uses shadcn/ui and Tailwind, kept on-brand by construction

2026-09-26 - Accepted (Ethan); corrects an undecided drift.
The research note recommended shadcn primitives (`docs/03-generative-ui-research.md`), but
`catalog-lab` was built in hand-written CSS without that ever being decided; from now on, new UI is
built with shadcn/ui and Tailwind v4 (faster, and agents write both fluently), while the existing
catalog components keep their verified CSS and move across only when touched, with before and after
screenshots, since a rewrite would put 73 ADRs of checked details at risk.
Three things keep agent-written UI from looking like everyone's defaults: (1) a token bridge, where
shadcn's theme variables (`--background`, `--foreground`, `--border`, `--ring`, `--primary`,
`--radius`) and Tailwind's `@theme` map to the Kay tokens, so anything an agent writes comes out in
Kay's paper, ink, hairlines and 4px corners; (2) a rules file the agents read, a `SKILL.md` under
`.claude/skills/` (which Kay also reads, so it doubles as the plugin's bundled skill, ADR-078)
saying tokens only and never raw hex, green only on button hovers, outline buttons by default, and
contrast checked in numbers (ADR-065); (3) a guard that fails the build, a lint rule or test that
rejects raw colour values in components, extending the contrast guard, so an agent cannot drift
without breaking the build.

## ADR-083 - The frontend is React Router as a single-page app, with no server rendering

2026-09-26 - Accepted (Ethan).
The app is React Router in framework mode (the mode Ethan knows) with `ssr: false`, built by Vite
into static files: the Web Worker, the browser's private file system and SQLite in WebAssembly exist
only in the browser, and Kay's own interface is a static bundle loaded from disk, so a
server-rendering framework (Next.js, TanStack Start, or React Router with `ssr` on) would add a
server the slice never uses.
Loaders are `clientLoader`s; Better-T-Stack's React Router template turns server rendering on by
default, so `ssr: false` is set and `@react-router/node`, `@react-router/serve` and the `start`
script are removed; one dedicated Web Worker, started with Vite's `new Worker(new URL(...), { type:
"module" })`, owns the agent loop and SQLite through the `opfs-sahpool` storage mode, which needs no
cross-origin isolation headers.

## ADR-084 - Sign-in is WorkOS AuthKit in the browser, with no auth server of our own

2026-09-26 - Accepted (Ethan).
Kay signs users in with WorkOS, so the slice does too, through `@workos-inc/authkit-react`, the
browser-only SDK: WorkOS hosts the sign-in page and stores the users, and `getAccessToken()` hands
the app a token; a layout route's `clientLoader` sends signed-out visitors to sign-in, and every
protected route nests under it.
The site's address must be on WorkOS's allowed origins list, and before relying on the deployed
site, check in WorkOS's docs how token refresh works outside localhost, where AuthKit's `devMode`
keeps tokens in `localStorage`.

## ADR-085 - The gateway is one Hono app on Cloudflare Workers

2026-09-26 - Accepted (Ethan); settles ADR-077, defers ADR-080.
A single Hono app (Ethan's familiar framework) on Cloudflare Workers is the slice's only server: it
verifies the WorkOS access token on every request against WorkOS's public signing keys, holds the
Anthropic and ElevenLabs keys as Worker secrets, streams replies and speech back, and stores
nothing, which keeps Kay's gateway promise and means only signed-in users can spend the model
budget.
The static site deploys to Cloudflare as well, possibly from the same Worker; Kay's own gateway,
Bifrost on Fly.io (ADR-080), can go behind this Worker later without changing the browser side.

## ADR-086 - The slice's wiring, tooling and one extra

2026-09-26 - Accepted (Ethan); completes ADR-083 to ADR-085.
One Cloudflare Worker, deployed with `wrangler`, serves both the static React Router build (`assets`
with `not_found_handling: "single-page-application"`) and the Hono API under `/api`, so there is one
deploy, one origin, no CORS setup and one allowed origin in WorkOS; Better-T-Stack scaffolds only
the frontend (backend and auth None), because choosing its Workers runtime forces Alchemy, a beta
tool built on Effect, and makes the web app render on a server, and the gateway comes from Hono's
own `cloudflare-workers` template, with WorkOS AuthKit added by hand.
The browser calls the gateway through Hono's typed client (`hc<typeof app>`), and the UI and the Web
Worker talk through one zod-checked message union (growing from `AgentEvent`), checked on arrival
like the catalog; tRPC and oRPC are ruled out because three streaming routes, one of them audio, do
not repay an RPC layer (oRPC is the one to revisit if the API grows).
Tauri is deferred and can be added later with `create-better-t-stack add --addons tauri`; storage
sits behind a `ConversationStore` interface (save, list, search, read), so a desktop build swaps
OPFS and SQLite in WebAssembly for native SQLite on disk with one new adapter.
Linting and formatting use Oxc (Oxlint 1.85 and Oxfmt 0.70, which sorts Tailwind classes), run by
Lefthook on staged files only, since every agent commit runs the hook; type checks, tests and the
raw-colour guard (ADR-082) run in the build and CI, where `--no-verify` cannot skip them.
The day-4 extra becomes visual regression and accessibility checks in CI (Playwright screenshots
across the Storybook states, plus axe), which matches the Design Engineer: Infrastructure post's
"state catalogs, screenshot and visual regression tests, and accessibility checks in CI" and
contains the contrast guard.

## ADR-087 - The repo is a pnpm monorepo in Better-T-Stack's layout

2026-09-26 - Accepted (Ethan); carries out ADR-086.
Better-T-Stack scaffolded only the frontend (`pnpm create better-t-stack@latest` with React Router
and every backend, database, auth and payments option set to none, plus the lefthook, oxlint and
turborepo addons), and the result was rearranged so the catalog stays one package beside its own
stories, schemas and tests: `apps/web` is the React Router single-page app, `apps/storybook` hosts
Storybook and the story tests over `packages/catalog` (`@yaklabs/catalog`, the former
`catalog-lab`), `apps/gateway` is the Hono Worker, `packages/runtime` is the Web Worker's agent loop
and conversation store, `packages/ui` holds the shadcn primitives on Kay's tokens, and
`packages/config` the shared TypeScript base; pnpm's catalog pins the versions every package shares
and Turborepo runs `build`, `typecheck` and the tests.
Three scaffold pieces did not survive the move: Varlock (an env codegen step; the app parses its
`VITE_` variables once with zod into a union with no half-set states), `bunfig.toml` and the server
entry (`@react-router/node`, `@react-router/serve`, `start`; ADR-083's `ssr: false` build keeps
`isbot` only because React Router's typegen installs it by itself when it is missing), and fourteen
of the seventeen generated shadcn components, which nothing imported and `shadcn add` restores in
seconds; `next-themes` went too, since React 19 refuses the inline script it renders inside a
client-rendered component, so a fifty-line module sets `data-theme` on the root, boots the stored
theme from the prerendered shell, and hands the toaster its theme as a prop.
Two token names collided with shadcn's and were renamed before the bridge was written: Kay's
`--radius` (14px, the card and the thread panel) is now `--radius-card`, and Kay's `--accent` (the
olive) is now `--olive`, so shadcn's `--radius` can be the site's 4px button corner and its
`--accent` the hover fill; the app loads `tokens.css` in a `catalog` cascade layer declared between
Tailwind's `base` and `components`, so the catalog keeps its bare-element styles above preflight
while a utility class on a shadcn primitive still wins.
Lefthook replaced husky and lint-staged and runs only on staged files (oxlint, oxfmt, the markdown
wrap), and CI runs everything else on pnpm with a frozen lockfile; oxlint runs with nested configs
off, because it otherwise picked up an example config under the vendored skills.
Every story rendered byte-identical before and after the move, and again after the token renames,
from screenshots of all forty stories taken twice from the old layout; the four that differ are the
dictation stories' live waveform and one chart animation, which differ between two runs of the same
code.

## ADR-088 - The runtime and the gateway, as built

2026-09-26 - Accepted (Ethan); carries out ADR-076, ADR-081, ADR-085 and ADR-086, and amends
ADR-081.
`packages/runtime` is the Web Worker that stands in for Kay's daemon: the page and the worker talk
only through one zod-checked union each way (commands `init`, `open`, `send`, `abort`, `list`;
notices `ready`, `opened`, `chunk`, `done`, `failed`, `listed`, `error`), the page checks its own
commands before posting and the worker checks them again on arrival, and the page's `startRuntime`
returns an `Agent` for the thread panel, so the UI did not change to move the loop off its thread.
Conversations live behind a `ConversationStore` (open, save, list, search) with two adapters, memory
and SQLite through `@sqlite.org/sqlite-wasm`'s `opfs-sahpool` VFS in a worker, as rows in
`conversations` and `messages` with an FTS5 index kept by triggers; the markdown transcripts ADR-081
describes are deferred, since the rows already give Kay's local store its shape and a file export is
one adapter away.
The worker saves the user's turn before the agent runs and the reply when it ends or is stopped, and
the model request it builds carries every card the agent showed as JSON in the assistant turn and
every card choice as a `[Card view: <label>]` line in the user turn, which is how the interactive
UI's state reaches the model (ADR-030, ADR-031).
`apps/gateway` is one Hono app on Cloudflare Workers with `run_worker_first` on `/api/*` and the web
build as its assets: `POST /api/messages` takes text turns only, verifies the caller's WorkOS access
token against the client's JWKS (jose), forwards the turns to `claude-opus-5` with adaptive thinking
and an 8192-token cap, and streams the SDK's own event stream back as newline-delimited JSON, which
the worker rebuilds with `MessageStream.fromReadableStream`; the browser calls it through Hono's
typed client, and both bindings live in the Cloudflare dashboard with `keep_vars` on.
Sign-in is WorkOS AuthKit in the browser behind a layout route that redirects signed-out visitors
and follows only a same-origin path back; the callback and the share page stay public, the settings
parse once into a union (agent lab or gateway, auth none or WorkOS), and the real-model path and the
token issuer remain unverified until a key and a person's sign-in are available.
The seam between the thread and the agent still carries text only, so cards come from the seed
thread today; card-producing replies are the next increment, and they change the seam, not the
worker or the gateway.

## ADR-089 - The compose canvas beside the thread, and a rail

2026-09-26 - Accepted (Ethan); carries out ADR-083 and extends ADR-041.
The thread page is two panes on one screen: the primary thread on the left and, to its right, the
compose canvas, a dotted field that grows into a row of lanes. The divider between them is a
`react-resizable-panels` separator (shadcn's Resizable primitive on Kay's tokens) that drags
anywhere along its length, with floors of 28% and 20% so neither pane can vanish; the library reads
a bare number as pixels and a string as a percentage, so the sizes are strings.
Two things land on the canvas. A highlight dragged out of any thread arrives as the browser's own
plain-text drag and starts a new thread of the same project: a fresh conversation in the worker's
store, titled by the highlight's first line, whose compose box opens with the highlight quoted and
the caret beneath it, so the user asks and no turn is sent on the drop. A card dragged by its header
opens large in a lane of its own; the header is the handle so the slider inside an interactive card
keeps its own drag, and the drag carries the same envelope a share link does (`SharedCard` under
`application/x-kay-card`), which is why a card can be dropped anywhere that reads that type. The
pointer says a highlight can be picked up before the browser's drag does: an open hand while it
rests on the highlight and a closed one from press to release, which is the same hand a card's
header shows.
Open space always remains at the end of the row, the whole canvas when it is empty and a slimmer
column once lanes exist, so there is always somewhere to put the next thing, and its copy names the
two drags. Thread lanes persist because their conversations do: the canvas lists every conversation
but the primary, oldest first, less the lanes closed by hand, whose ids live in localStorage. Card
lanes are a way of looking and last the visit.
The header became a rail: the Kay mark, Thread and Lab as icons with tooltips, and at the foot the
theme and the account. GitButler's workspace was the reference for the concept (lanes on a canvas,
open ground kept to the right), not for the look; the rail and the canvas use Kay's paper, hairline,
serif and olive.
Amended later the same day, after the first run on Ethan's machine. The hand shows only over a
highlight that already exists: while a button is down the selection growing under it keeps the
I-beam, as every word processor has since the nineties, and the hand appears on release. Lanes
resize by the gap after them: the whole gap takes the drag, and while the pointer is on it a hint of
a line shows, full ink for 20px either side of the pointer's height and gone by 50px, which
JetBrains Air does along a full-height blue line; the divider between thread and canvas shows the
same hint.
Lanes reorder by their title bar, the same bar that drags a card out of a thread, or by the grip in
the strip above them, and a hand over either says so. Past a small dead zone the lane lifts, after
GitButler's pattern: a copy of it floats under the pointer, near-opaque with a shadow, while the
lane itself stays in the row dimmed and, once its centre crosses a neighbour's, slides into the
slot it would take as the lanes it passes step aside. The placeholder is therefore the lane's own
shape, never a blank; the copy is a snapshot of its DOM with the draft and the scroll carried over,
and the row's DOM is left alone until the drop, because moving the pressed element would release
its pointer capture. The bar is the handle by its middle and right: a six-dot grip fades up at its
centre while the pointer is on that part, and stays away from the far left, where the title is a
field waiting to open. A click on the title renames the thread in place, Enter keeps the new name
and Escape the old, and the worker keeps it (`rename`, answered like `open`), for a lane and the
main thread alike; a card's title comes from its payload and stays. Nothing sits above a lane but
its close. The order is kept in `kay.canvas.order` beside the hidden list, and Shift with the arrow
keys on a gap moves the lane before it one slot. The canvas has no right edge: once a lane is on
it the ground runs a full pane past the open space, a thin scrollbar in the rule colour stays in
view to say so, and the ground itself drags to pan. A card dragged out of a thread rides the
pointer whole, the drag image being the card and not its handle, and the card left behind dims
until the drag ends. A
vertical wheel over the ground pans the row, since the row has nothing vertical to scroll. The open
space reads "Drag a text selection or card / to start a new thread with context" over the catalog's
own button, "Create blank thread", the one a card's "Show my work" uses. The close stays in the
strip, with the site's 4px corners. Moving it into the thread's title bar was built and axed: it
cost the panel a prop and the card lanes a title bar of their own, for a change Ethan chose not to
make yet.
Not yet: a drop between two lanes, a keyboard path for a highlight (the Create blank thread button
is the keyboard route today), card lanes that persist, and the row scrolling itself while a carried
lane nears its edge; each is in `docs/LATER.md`.

## ADR-090 - Dark mode for every surface

2026-09-26 - Accepted (Ethan); extends ADR-046.
ADR-046 themed only the attention surfaces, so the toggle switched `data-theme` and the page stayed
light. Dark mode now redefines the page's roles under `:root[data-theme="dark"]`: the window is the
site's night green (`--yak-night`), the app surface a step above it (`#1a1e1a`), hover and inset a
step above that, the compose box and menus lifted again, and the cream that was the paper becomes
the ink (14.7:1) with a soft ink at 72% cream (8.1:1). Lines are cream at 72% and 18%; the olive
lifts to `#8e9d6f` so the slider's accent clears 3:1 (5.8:1); chart marks lift to `#b5b5ae`
(8.2:1); the user's bubble is sage over the dark paper at 16%, 30% and 45%; shadows deepen; the warm
notice and the recording dot get dark values of their own. Every ratio is measured against the dark
paper and written beside its token.
Three things had to be true first. The cream got a name of its own (`--yak-cream`), because the
attention tokens and the outline button's hover said `var(--paper)` where they meant the cream, and
a dark paper would have made that text vanish; `--on-accent` is the cream in either mode, and
`--on-ink` (paper in light, night in dark) is what sits on an ink fill, which the shadcn bridge maps
to `--primary-foreground`. The hard-coded whites on the default button and the workbench's current
item became `--control-bg`, and menus draw on `--compose-bg`, the lifted surface, instead of the raw
bright paper.
Proof: all 42 stories shot in light before and after, byte-identical or matching a canonical set on
a rerun; all 42 shot in dark through the screenshot lever's new `--theme` option and read by eye;
and the browser lever measures that the page, the paper and the ink all change when the toggle is
used, instead of trusting the attribute.

## ADR-091 - A carried card or highlight is pointer-driven, not an HTML5 drag

2026-09-27 - Accepted (Ethan); amends ADR-089.
During a native HTML5 drag the operating system draws the cursor and the browser ignores every CSS
`cursor` rule until release, so the closed hand shown on press could never survive the drag:
measured on `main`, one `dragstart` fired and the element under the pointer read `cursor: auto`, and
the only drop feedback lived on the open space at the far end of the row, off-screen once a lane
existed.
Cards and highlights therefore travel by a pointer-driven carry the page draws itself, which keeps
the closed hand from lift to release, lights the whole canvas, lands the drop in the gap under the
pointer and lets Escape cancel.
Ethan accepted losing drags out to other apps, which only ever received the card's title as plain
text, because the arrow reappearing mid-drag reads as unpolished; the Share link stays the way to
take a card elsewhere.

## ADR-092 - Threads started on the canvas are sub-threads of the main thread

2026-09-27 - Accepted (Ethan); extends ADR-089.
A project holds any number of main threads, and a thread started on a main thread's canvas is that
thread's child, one level deep, listed under it in the sidebar as a "↳" row.
Opening a main thread or any of its children loads the same whole view, the main thread beside its
canvas, with the child's lane brought into view.

## ADR-093 - The sidebar is shadcn's Sidebar, with Conductor's project rows

2026-09-27 - Accepted (Ethan); carries out ADR-082.
Navigation becomes shadcn's `Sidebar` with `collapsible="icon"`, whose collapsed state is today's
56px rail, instead of a hand-made tree; it already brings the toggle, the keyboard shortcut,
skeleton rows, row actions and nested sub-rows.
A project row reads "name >" when folded, shows no chevron while open until the pointer is on the
name, and carries a "+" that starts a new thread in that project, after Ethan's Conductor
screenshots.

## ADR-094 - The web app draws itself as a desktop window with a tabbed title bar

2026-09-27 - Accepted (Ethan's brief; built and proven by the workspace lever's P9 to P11).
Following Kay's desktop app without changing our look, the app is a window inside the viewport with
decorative traffic lights and one title bar across its full width: the sidebar toggle at the far
left, tabs in the middle, and at the far right the notifications bell and then the account avatar,
which takes the corner because the signed-in account matters more.
Each tab restores one of three layouts, a thread alone, a thread beside a simulated browser, or a
thread beside the compose canvas, and the rail keeps the Kay mark with a documentation link beneath
it.

## ADR-095 - The Kay mark is the vector Kay's site declares

2026-09-27 - Accepted.
meetkay.ai declares its mark as one SVG polygon (`viewBox="0 0 78.59 78.54"`,
`fill="currentColor"`), so the rail draws that polygon instead of a trace of a screenshot, the same
rule ADR-051 set for colours: brand assets come from what the brand declares, never from pixels.

## ADR-096 - Mock scenarios never touch device data, and the app says which is which

2026-09-27 - Accepted (Ethan's brief; P7 loads every scenario twice and compares bytes).
Deterministic scenarios for long content, loading, failure and empty states run on a store built in
memory from fixed fixtures and never open the device's database, so a demo can never overwrite or
read real conversations.
The app states plainly whether an action is mock, kept on this device, or live with a real model:
"Live data can follow, with a clear indication when actions have real effects."

## ADR-097 - A lane's title runs the whole bar, and the grip veils it only on hover

2026-09-27 - Accepted (Ethan); amends ADR-089.
ADR-089 kept a lane's title to half its bar so the six-dot grip never met it, which cut every
longer title in half at rest. The title now hugs its text and runs the whole bar; while the pointer
is on the bar's drag area the grip fades up over a veil in the bar's own paper that fades out the
stretch of title beneath it, and the veil is the grip's hit area, so a press there drags the lane
and never renames. The rename field draws no rule while editing, so the title reads the same in
the same box the moment it opens.
Proof: the workspace lever measures the whole title at rest, the ink beside the grip going from 37
at rest to 162 on hover, and a 0px rule in the field (`docs/trail/evidence/projects-sidebar/css`).

## ADR-098 - The Disclosure's hover fill sits 4px inside its host

2026-09-27 - Accepted (Ethan).
The inset the Awaiting card gave its fold by hand now belongs to the Disclosure primitive, so the
"How I got this" story and every later host get a hover fill that stops short of the card's edges;
the Awaiting stories render byte-identical in light and dark after the move.

## ADR-099 - The worker owns the workspace and pushes one snapshot

2026-09-27 - Accepted; carries out ADR-092 and ADR-076.
Of four designs put side by side, the one with the smallest surface won: the page sees one
observable state and five verbs (`open`, `create`, `rename`, `arrange`, `agent`, plus `saveShell`
for the tabs), and the worker pushes the whole workspace (projects, threads, lanes, the shell, no
messages) after every write, skipping a push that would change nothing. Every command carries a
request id and every answer names it, so one failed call no longer fails every call in flight,
and a write's snapshot always arrives before its answer. A closed lane is an absent lane,
`arrange` sets a main thread's whole lane list (move, close, reopen, resize and a card drop are
all one verb), and renames, arranges and shell saves show at once and roll back if refused.
Proof: 137 runtime tests, among them the ordering, attribution and dedup cases in
`packages/runtime/src/agentLoop.test.ts`.

## ADR-100 - Schema v2 carries the first build's data over, and converges

2026-09-27 - Accepted; extends ADR-081.
SQLite gains projects, a parent link on conversations, lanes, the shell document and
notifications, with checks and triggers that refuse a grandchild, a lane on the wrong canvas and a
card lane that names a thread. The upgrade is a list of steps keyed by `user_version`, each one
transaction; the first build's data becomes project "Demo store" with `profit` as its main
thread and every other conversation its child, the two localStorage lists deciding which lanes
stay open and in what order. The page clears those lists only after the device store opens on
the private file system, so a second tab on memory can never lose them.
Proof: a browser test writes the first build's exact schema with rows shaped like Ethan's,
migrates twice and once more after a crash inside the step, and gets identical rows each time with
an empty foreign key check (`packages/runtime/src/sqliteStore.browser.test.ts`).

## ADR-101 - Scenarios load through the store's own writes, with faults as data

2026-09-27 - Accepted for the runtime; extends ADR-096.
Each scenario (demo, empty, long, loading, failure, thread-fails) fills a fresh in-memory SQLite
through the same writes the app uses, so a fixture cannot hold a state the schema refuses; the
clock is fixed, ids count up and turn times are in UTC, so every load is byte-identical. Loading
and failure are data on the fixture (hold forever, or fail with a fixed reason), never timers, so a
screenshot of a loading state is stable. A scenario always answers with the lab stand-in.
Proof: `packages/runtime/src/scenarios.test.ts` and `agentLoop.faults.test.ts`.

## ADR-102 - A carry claims its press on pointerdown

2026-09-27 - Accepted; amends ADR-091.
Measured in Chromium before building: cancelling `dragstart` keeps the pointer events coming but
collapses the highlight on the first move, while `preventDefault` on `pointerdown` stops the
native drag and keeps the highlight through press, moves and release. The carry therefore claims
the press on `pointerdown` and still refuses `dragstart` inside the thread as a backstop; it
swallows the click that follows a lifted carry, as a native drag does, and a click on a highlight
without a lift still clears it. The carry is a pure state machine (idle, armed, carrying) behind a
thin DOM shell, cancelled by Escape, the window's own blur, `pointercancel` or lost capture.

## ADR-103 - A pinned thread stays pinned through the layout's own scrolls

2026-09-27 - Superseded by ADR-109.
Chromium's scroll anchoring moves a thread's `scrollTop` while a chart above sizes itself, and the
scroll event it fires landed with the thread a pixel or two short of its end, so the thread
unpinned itself and rested short (2 of 15 fresh loads of one dictation story, 7 of 15 of another).
Only a reader's scroll unpins now; a scroll the layout caused keeps the pin. After the change, none
of 90 loads across six thread stories rested short. The rule is a pure step with a table test.

## ADR-104 - The lab stand-in answers every message

2026-09-27 - Accepted (Ethan's screenshot).
The scripted agent stayed silent on a message with no card choice and no file, which in a demo
reads as a broken thread. It now answers a plain message with one scripted line that says it is
the lab's stand-in.

## ADR-105 - An open tab stays mounted until it closes

2026-09-27 - Accepted; extends ADR-094.
A tab is an open main thread, and the address `/t/:threadId` picks which one is on screen. Every
tab visited stays mounted, stacked in one grid cell: a hidden one is `inert` and skips rendering
through `content-visibility: hidden`, which keeps its scroll, draft and running reply where
`display: none` would drop the scroll. Only closing a tab unmounts it.

## ADR-106 - The pane beside the thread keeps fixed limits

2026-09-27 - Accepted.
The panel library applies a panel's new size limits one render late, so a pane made collapsible
in the render that collapses it refused to close, and the Thread layout left a fifth of the tab
blank (measured 932 and 233 px). The side pane is now always collapsible with fixed limits. A drag
that reaches the far edge closes it only until release, when the saved layout comes back, so the
layout switch stays the one control that decides what sits beside the thread.

## ADR-107 - Screenshot levers run Chromium without partial raster

2026-09-27 - Accepted.
With partial raster on, Chromium redrew only part of a tile, so two loads of the same page
differed by 1 to 4 colour levels at a few rounded corners, depending on load order. The app was
the same both times, so the check was wrong. The levers launch with `--disable-partial-raster`, and
the byte-exact comparison of two loads stays strict (24 of 24 loads identical).

## ADR-108 - A press already claimed never lifts its lane

2026-09-27 - Accepted; follows ADR-102.
A carry claims its press with `preventDefault`, not `stopPropagation`, so the press still bubbles
to the lane around it. A lane's reorder therefore takes only a press nobody claimed, or a card
header inside a thread lane would lift the card and its lane together.

## ADR-109 - A thread decides whether to follow its end when it resizes

2026-09-27 - Accepted; supersedes ADR-103.
ADR-103 judged the pin from scroll events, but a scroll event reads the layout when it is
delivered, not when the scroll happened. A reader who scrolled up in the frame a streaming reply
grew therefore looked like a layout scroll, and the thread snapped back to its end. Two rules over
scroll events were measured and failed (23 and 12 of 360 loads rested short).
Browser scroll anchoring is now off on the thread (`overflow-anchor: none`). The thread decides
when it resizes: it follows its end only if the gap before the resize (the gap now, less what the
resize added) was under 2px. A view that gets shorter, such as the compose box growing, counts as
the end moving away.
Measured in a real browser, a reader's scroll-up during streaming is now kept in all four thread
stories, and 0 of 360 fresh loads rest short. The cost is that when content above a reader who
scrolled up grows, it now pushes their view down, where anchoring used to hold it in place.

## ADR-110 - The title bar is green window chrome, the same in both themes

2026-09-27 - Proposed (Ethan's mock R9; the hex is his to confirm, Q3); amends ADR-055 and ADR-058.
Green was kept for button hovers alone; the title bar now carries it too, as window chrome, which
is not content and so does not compete with the hover. `--chrome` is `#3b423c`, sampled from the
mock and flagged in `tokens.css` until Ethan names the value.
The bar is the same in light and dark, as a desktop window's frame and its traffic lights are,
and everything on it is cream: `.chrome-surface` remaps Kay's roles and the shadcn roles its
primitives read, the way `.attention-surface` does, so no component carries colours of its own.
Ink is cream (8.98:1), soft ink cream at 72% (5.56:1), a hover fills cream at 8% (1.25:1, so a
skeleton tab still shows), and focus is the site's own 2px ring in cream, restored over shadcn's
`outline-none`, which had left a 1px ring at 1.3:1 to 3.2:1.
"Selected" on the bar, the active tab and the pressed layout, is one cream pill with the night
green on it (8.98:1 against the bar, 16.1:1 for its text). The pill is the same in both themes:
the page's own paper would have been 1.63:1 against the bar in dark mode.
The avatar's ring keeps a blend in both themes, since dropping it switched every glyph on the page
from greyscale to subpixel smoothing in Chromium. An avatar with no picture shows its initials in
the full cream (7.21:1 on its fill), not the soft ink (4.47:1), and shadcn's half-strength ghost
hover in dark mode is set back to the full fill, so the bar is the same picture hovered too.

## ADR-111 - The window sits on a desk of its own, 16px in

2026-09-27 - Proposed (Ethan's mock R9; the ground and the margin are his to confirm, Q10).
The page behind the window is `--desk`, not the app's own ground, so the window's sides and bottom
show against it: a warm grey between Ethan's two stone greys in light mode (1.43:1 against the
paper, 1.54:1 against the bright paper), where the mock's cool grey would be a sampled colour
(ADR-051); his slate in dark mode (2.75:1 against the paper). A desk darker than the dark paper
cannot reach 1.3:1, since black itself is 1.24:1.
The margin is 16px from 768px up, as in the mock, instead of 8px, and the contract's frame line
says so. Below 768px the window is still full-bleed.

## ADR-112 - A trim frames the window's body, olive until Ethan picks

2026-09-27 - Proposed (Ethan's mock R10; placement, colour and whether it is a Figma outline are
open, Q5 to Q7).
A 2px `--trim` line runs under the bar, down both sides and along the bottom, following the
window's bottom corners. It is drawn over the body's edge on a layer of its own, so no box below
the bar moves and every pixel under it paints as before; drawn in the page's own layer, it had
made Chromium composite a dark-mode fill a level off.
Its colour is olive (6.57:1 against the bright paper, 5.79:1 against the dark paper), not the
mock's blue, which no token declares and which reads as a keyboard focus ring (ADR-053).

## ADR-113 - The empty canvas shows a splash

2026-09-27 - Proposed (Ethan's brief; the drawing's source is his to supply, Q11).
While the canvas has no lanes, a line drawing sits behind its words and Kay stands at the open
space's bottom right. Both are pictures only: hidden from the accessibility tree, and a press, a
pan or a carried card goes through them to the ground. The first lane that lands sends them away,
and they come back with the last lane closed.
The drawing is a CSS mask filled with `--splash-line`, the ink at 12%, so only its strokes show
(1.26:1 against the field in light, 1.36:1 in dark) and it themes with the ink. Until the Atlas
figure's source arrives, the mask is an original drawing, a sphere on a desk stand over
golden-ratio construction lines.
Kay is a transparent WebP cut from the mock by `cut-kay.mjs`, a placeholder until Kay's published
file arrives. He hides where the open space is under 480px, and there is no idle animation; the
splash fades in over 150ms, and not at all under reduced motion.
Bottom to top: the dotted field, the carry's lit fill, the drawing, the words and the button, and
Kay, so a carry tints the ground but never the drawing, and Kay stands in front.

## ADR-114 - Kay's face is the avatar when the build has no sign-in

2026-09-27 - Proposed (Ethan's mock R9; who the face stands for is his call, Q8).
The mock puts Kay's face in the title bar's corner, which ADR-094 gives to the account. With
sign-in off there is no account to show, so the corner shows Kay; a WorkOS user keeps their own
picture or initials. The button's name stays "Account" and the picture has no alternative text.

## ADR-115 - The title bar can be painted, and stays solid by default

2026-09-27 - Proposed (Ethan's exploration; the default and the painting itself are his to choose,
Q2 and Q4).
The painted bar is an oil painting under a moss wash at its ends, over the painting's mean colour,
so a slow or blocked image still leaves a passing bar. The painting is made in the repo by
`paint-chrome.mjs` from seeded noise, so it is ours to ship and identical on every run. The script
decodes the WebP it wrote and lowers its clamp until no pixel of the file is brighter than
luminance 0.10, since the lossy encode lifted some pixels past the clamp it was given (0.134 at
first). On it the soft ink is cream at 85% (4.87:1 on the brightest pixel); cream at 72% would
fall below 4.5:1 there. `painting.json` records the decoded mean and maximum, and the token test
reads it.
Its hover and skeleton fill is a night wash (1.37:1 over the painting's mean) rather than the flat
bar's cream fill, which vanished on a painting of the same green (1.03:1); a wash only darkens, so
the inks on it only gain.
The solid bar is the default. `?chrome=painting` or `?chrome=solid` picks one once: a boot script
takes it out of the address before the router starts, as the theme's does, since the app's own
links keep only the scenario and a leftover parameter would undo a later choice. The choice is kept
in localStorage and held for the visit in memory too, so a refused storage still keeps it. The
Account menu has a Title bar choice beside
Theme, so Ethan can switch while he decides.

## ADR-117 - A lane's gap reports the lane's width, and a lane is 320 to 1800px wide

2026-09-27 - Accepted; amends ADR-089.
The gap after a lane takes the focus and resizes by arrow key, so ARIA requires it to carry a
value, and axe failed every gap for lacking one. It now reports the lane's width in pixels, read
aloud as "480 pixels wide", within a range that a drag and the arrow keys both keep to: 320px, as
before, up to 1800px, which fills the widest canvas a 2560px screen lays out. A default column in
a pane too narrow for 320px widens the range to hold its width rather than report a value outside
it.

## ADR-118 - One tab at a time opens the device's threads, and a failed open cannot delete them

2026-09-27 - Accepted for the guard against the delete; the held second tab is Proposed until Ethan
decides whether a blocked second tab is the experience he wants. Extends ADR-081 and ADR-100.
sqlite-wasm's `opfs-sahpool` installer answers any failure by deleting the pool's directory,
every database in it included (`removeVfs`, recursive). A second tab always failed, since the
first holds the pool's access handles, so it tried that delete on every open, and only the first
tab's handles stopped it; a first tab letting go in the gap lost every thread (3 of 15 trials in
the review's harness, and every time in a browser test that lets go at that moment).
Two guards now close it. The worker takes the Web Lock `yaklabs-database` before it opens the
database and keeps it for its life, so a second tab never touches the pool: it says "Your threads
are open in another tab" and opens them once the first tab closes. It no longer falls back to
memory, where a fresh starter labelled "Not saved" stood over the real threads; memory stays for
a browser that refuses the file system or has no Web Locks. And the store holds a file in a
subdirectory of the pool's own, where the pool never looks, for as long as its worker lives:
Chromium refuses a recursive delete while any file under it is open, and refuses it whole, so
the installer's clean-up cannot delete the pool whatever made the open fail and whoever lets go.
Measured before choosing: 0 of 60 ended lock holders left a handle busy for the next holder, 0 of
45 reloads heard the held notice, and a holder that ignores the lock (an older build) lost
nothing in 15 trials, against 3 before. The guard leans on the library's `.opaque` directory,
whose name the library itself says never changes; the browser test fails if it stops guarding.
Reloading the tab that has the threads while another waits hands them to the waiting tab, and
the reloaded tab then waits in turn and says so; nothing is lost.

## ADR-119 - On a phone the workspace shows one pane at a time

2026-09-27 - Accepted (Ethan).
Below 768px, a thread beside the canvas or the browser left each about 185px, so the chart's
labels overlapped and its buttons were cut off. On a phone the Layout switch now picks the one
pane that fills the width (Thread, Browser or Canvas), and the others collapse. They stay mounted
and inert, so a draft or a streaming reply survives a switch. The panel group and its fixed
limits stay the same on every screen (ADR-106): the thread's panel is now collapsible too, so a
phone and a wide screen differ only in the layout the switch asks for, and crossing the
breakpoint remounts nothing.

## ADR-120 - On a phone the title bar puts the tabs on a row of their own

2026-09-27 - Accepted (Ethan, relayed by the PR #13 session).
At 390px the one-row title bar squeezed the tab strip to nothing and slid New thread under the
data marker. Below 768px the tabs now take a row of their own under the controls, 80px in all,
so every tab stays whole and tappable. A one-row, 44px bar that hid the Layout switch behind a
button was tried in #14 and withdrawn: Ethan wants two rows on a phone and one on a wide screen.
With ADR-119, a phone shows the controls, then the tabs, then one pane.
