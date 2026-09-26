# Architecture Decision Records

Each record is 1-3 sentences.
Status is one of: Proposed, Accepted, Watch (decided for now, revisit as we learn), Superseded (by ADR-N).
Newest records go at the bottom.

## ADR-001 - Focus on agent legibility

2026-09-24 - Accepted.
Of the three problems in the posting, we build the demo around making agent work legible.
It is the product's core promise, it shows timing, hierarchy, and progressive disclosure directly, and it can be demoed with scripted data.

## ADR-002 - Treat Glass as inferred DNA for Kay

2026-09-24 - Accepted.
The Kay docs were unreachable from this environment, so Kay's vocabulary and surfaces come from search snippets, with Ramp's Glass as the likely ancestor.
Anything inferred from Glass is labeled as inferred and must be checked against docs.meetkay.ai before the interview.

## ADR-003 - The user's input never moves

2026-09-24 - Accepted.
The compose field keeps its size and position while typing, dictating, or streaming, and streamed output never pushes the input down.
People proofread as they type, so layout shifts break their place.

## ADR-004 - Recognition over recall for skills

2026-09-24 - Superseded by ADR-009.
Typing `/` shows a filterable list of skills inline, and the chosen skill appears as a visible chip before sending.
Users never need to memorize skill names or wait for "loading skill" to confirm.

## ADR-005 - Summaries are views over structured events

2026-09-24 - Proposed.
The agent records typed events (tool called, file changed, message sent), and every summary is rendered from those events, with each line linking to its evidence.
We avoid a second model narrating the first after the fact, because that narration can drop or invent details.

## ADR-006 - Outcomes first, steps second

2026-09-24 - Proposed.
Agent work is shown by what changed in the world (sent, changed, spent, waiting on you), with the step-by-step trace one disclosure layer down.

## ADR-007 - Confirmation weight matches irreversibility

2026-09-24 - Superseded by ADR-010.
Reversible actions take a tap; irreversible ones use hold-to-confirm, with the hold getting longer as the consequence grows.
The playful interaction doubles as a signal of how much the action matters.

## ADR-008 - Legible work becomes remixable work

2026-09-24 - Proposed.
A finished run renders as a reactive recipe (like marimo) where editing an upstream step re-runs the steps after it, and any run can be saved as a skill.
This ties legibility to the success metric: users creating their own workflows and skills.

## ADR-009 - Skills match from plain language, confirmed as a chip

2026-09-24 - Accepted.
Typing plain words (e.g. "create watcher workflow") shows matching skills in a popup above the input; Tab applies one, and Enter sends as typed unless the user arrowed into the popup.
The matched words become a chip inside the compose box (Backspace turns it back into text), so users get natural language and visible confirmation without memorizing a `/` command, which remains an optional power-user shortcut.
Principle: no special syntax to invoke a skill, but immediate confirmation that it is applied, so the user is never left wondering what the agent will do with their message.

## ADR-010 - Tap to choose, hold to ship with your defaults

2026-09-24 - Accepted.
Tapping an action opens its options; pressing and holding skips the options and runs with the user's saved defaults, which appear inside the fill bar as it fills (release early to cancel), and the fill takes longer for actions that are harder to undo.
After the same choices repeat, the options panel suggests "hold to skip this next time", and hold falls back to opening the panel when a default looks wrong for the current context.
This keeps full agency on tap and adds throughput on hold, modeled on Amp's hold-to-ship.

## ADR-011 - Documents autosave; agent edits are named versions

2026-09-24 - Accepted.
New documents and artifacts save automatically, with an auto-generated title in a predictable place, matching the Google Docs habits of knowledge workers.
Every agent edit is recorded as an attributed, restorable version, and when the user is editing at the same time, agent changes land as suggestions instead of overwriting their text.
This sets the product-wide line: changes inside Kay are automatic and reversible, while effects that leave Kay (send, share, publish) are deliberate (ADR-010).

## ADR-012 - Pin to lock what you like

2026-09-24 - Accepted.
Users can pin a whole document or a single section (pin icon appears in the margin on hover), and the agent treats pinned text as locked: it never rewrites it and says when it left pinned text alone.
Unpinned text may be edited directly and restored from version history (ADR-011); pinned text only ever receives suggestions.

## ADR-013 - Agent edits are reviewed as a redline

2026-09-24 - Proposed.
Proposed changes render as a redline, with strikethrough for removed text and a non-formatting marker (underline or highlight tint, not bold) for added text, so the signal never depends on red/green or collides with real formatting.
Each change is accepted or rejected individually from a review panel; on accept, struck text collapses away (~200ms) and the new text settles to normal styling.
Open: inline redline plus a review-list panel, versus a side-by-side compose panel; prototype both.

## ADR-014 - Charts are tested catalog components; the LLM only describes data

2026-09-24 - Accepted.
Each chart type (`LineChart`, `BarChart`, and so on) is built and tested once as a Kay catalog component, and the LLM only emits a validated data description (series, fields, a small set of deliberate options such as reference lines), never new chart code.
Requests outside the catalog get an honest fallback ("I can show this as a table") instead of improvised UI.
The engine is Recharts (mature, shadcn's default) hidden behind the catalog, so switching to TanStack Charts later touches only the catalog.

## ADR-015 - Catalog components vary by options, split by purpose

2026-09-25 - Accepted.
Variations such as reference lines, stacking, and annotations are optional, individually tested props on one component (e.g. `LineChart`), which the LLM fills as data and never as nested JSX, because props compose while variant components multiply.
A new component is justified only when the purpose or data shape changes (e.g. `Sparkline` inline in text, or `BudgetVsActual`).

## ADR-016 - Watch the catalog's long tail

2026-09-25 - Watch.
The line between "an option on an existing component" and "outside the catalog" will keep moving as users ask for things we did not predict.
Every out-of-catalog fallback is logged with what was asked, and recurring requests are promoted to new options or components, so the catalog grows from real demand; revisit the fallback rate and the option budget per component regularly.

## ADR-017 - Kay suggests skills from repeated patterns

2026-09-25 - Accepted.
When a user repeats a similar request, Kay suggests turning it into a skill, but only at a natural pause after a run completes, showing the evidence ("asked 3 times: Mon, Wed, today") and opening the draft as an editable recipe (ADR-008) before anything is saved.
Suggestions offer "Not now" and "Don't suggest this" and are frequency-capped; this is ADR-016's feedback loop at the scale of one user, inspired by Hermes agent.

## ADR-018 - "Previously on": a recap when the user returns

2026-09-25 - Superseded by ADR-027.
After time away (time since last input plus the window losing and regaining focus), a short outcomes-first recap of the last runs appears above the compose box, rendered from recorded events with links to evidence (ADR-005/006), inspired by Amp.
It overlays the conversation without moving the input (ADR-003) and collapses into a "Recap" chip as soon as the user types.

## ADR-019 - A pop-out Kay for work across threads

2026-09-25 - Accepted.
A pop-out chat outside the thread list, summoned anywhere by a global shortcut, handles side questions, status across threads and projects, and orchestration, inspired by Amp's Puck.
Threads are for doing a piece of work and the pop-out is for talking about your work; when a side question becomes real work, it is handed off to a new thread visibly, and the user-facing name avoids the word "orchestrator".

## ADR-020 - Edit and Remix open a linked new thread

2026-09-25 - Accepted.
Refining a skill or a chart/table starts a new thread so the original flow stays clean.
Both threads link to each other ("Remixed from" / "Remixed to"), and finishing the remix offers "Use this in the original", which updates it as a named version (ADR-011), so forks never become orphans.

## ADR-021 - User messages are high-contrast landmarks

2026-09-25 - Superseded by ADR-025.
The user's messages render as contained cards with a distinct fill and weight (contrast without loud colour), so they work as chapter headings when scrolling back.
While scrolling through a long answer, the question it answers stays pinned at the top of the thread.

## ADR-022 - The scrollbar is a map of the conversation

2026-09-25 - Accepted.
Each turn is a marker on the scrollbar; hover shows the request and a turn summary built from recorded events (ADR-005), and clicking jumps so the user's message lands vertically centered every time (eye trace), inspired by Zed's Delta.
Markers are coloured by kind (user message, outcome, waiting on you), have generous hit targets, and support bookmarking.

## ADR-023 - Catalog cards size to their panel, not the screen

2026-09-25 - Accepted.
Catalog components live inside a chat thread whose width depends on split panes, so they use container queries with three densities: compact (under ~480px), standard (~480-720px), and expanded (opened in the side pane).
Inside a thread, cards drop page-level framing (no repeated question, no large headings), offer "Open in pane" for exploration, and reserve their final height before rendering so the conversation never jumps (ADR-003).

## ADR-024 - Strict single-card selection before A2UI

2026-09-25 - Accepted.
The agent selects exactly one catalog card with required and optional props and a meaning-bearing variant; one invented field rejects the whole card.
This answers "can the goal be reached without A2UI?" with yes, and makes every failure loud and specific, which speeds up iteration; A2UI-style component trees and streaming stay out until a real need appears.

## ADR-025 - User messages rest on the thread as tinted bubbles

2026-09-25 - Accepted.
The thread background stays dominant; the user's message is a soft tinted surface on top of it, right-aligned at up to 85% width with a hairline border and the time below, so it is recognised as "you" by shape and position rather than heavy contrast.
A full-width dark treatment was tried and read as a section header; findability when scrolling back comes from the scrollbar map (ADR-022), and the question being answered still stays pinned at the top while scrolling a long answer.

## ADR-026 - One compose box everywhere: attach left, dictate and send right

2026-09-25 - Accepted.
Every chat compose field is the shared `ComposeBox`: a paperclip attach button on the far left, and a microphone for dictation directly left of the send button.
It floats directly under the conversation with no divider line above it, and keeps a fixed height so typing never moves it (ADR-003).

## ADR-027 - Recap after ten idle minutes on an active thread

2026-09-25 - Accepted; "Needs you" items moved out by ADR-039.
When a thread is still active and the user has sent nothing for 10 minutes or more, a recap of recorded outcomes appears above the compose box, "Needs you" items first, each jumping to its evidence turn (ADR-005/006, ADR-022), inspired by Amp's recap.
It overlays the conversation without moving the input, collapses to a chip while the user types, stays dismissed for the current idle stretch, and uses no decorative ribbon or badge.

## ADR-028 - Dictation takes over the thread as a modal

2026-09-25 - Accepted.
Tapping the mic opens a modal over the thread with a dimmed backdrop and a disabled compose box, which tells non-technical users plainly that typing is paused while recording.
Its large waveform works like a DAW with the playhead locked to the center: new audio enters at the playhead and scrolls right to left, with a dotted line for the empty timeline ahead (after Amp's waveform); a live transcript preview, a microphone picker, Esc to cancel, and Enter or Done to insert complete it.

## ADR-029 - Interactive cards react in the runtime, never through the model

2026-09-25 - Accepted.
Catalog cards may carry controls (switch, stepped slider, numeric slider) bound to precomputed data and to live text templates, and Kay's runtime updates the chart and the agent's sentence instantly on every change, with no model call per interaction (after marimo's reactive elements).
Controls must fit the data (sliders need a numeric range or labeled stops; two meanings become a switch), the agent says when it translated a request into a different control, and a "Show recipe" view reveals the steps whose controls become skill settings (ADR-008, ADR-017).

## ADR-030 - Every interactive surface reports its state back

2026-09-25 - Accepted.
When the user changes an interactive card or custom view, its current state attaches to their next message as a visible, removable chip (e.g. "Net profit · Sep 14-20"), so the agent answers about what the user is actually looking at.
This applies to catalog cards and to model-written custom views alike (the typed export is the contract, after the "copy as JSON" pattern in Thariq Shihipar's HTML article), and it follows ADR-009: no hidden context, and the user always sees what the agent will act on.

## ADR-031 - Interaction is conversation: the user's choices feed the agent

2026-09-25 - Accepted.
Meaningful choices the user makes in any interactive surface (card controls, accepting or rejecting redline changes, pins, sorting on a bucket board) are fed back to the agent as structured, visible input, so the chat becomes a live feedback loop where the user steers by doing, not only by writing.
This keeps users engaged and playing instead of checking out while reading walls of text, which serves the goal of turning them into creators; only meaningful choices count (no hovers or scrolls, and only a card's latest state), and every choice travels as a visible, removable chip (ADR-009, ADR-030).

## ADR-032 - Two tiers of interactive surfaces

2026-09-25 - Accepted.
Tier 1 is catalog cards, static or interactive: Kay's catalog builds them, the agent only describes data, controls, and live text, and everything invented is rejected (ADR-024, ADR-029); tier 2 is custom views, model-written HTML (after Thariq Shihipar's HTML article) for throwaway personal tools, sandboxed, styled with Kay's tokens, and visibly labeled as custom.
Both tiers return the user's choices to the agent through the same visible chip (ADR-030, ADR-031), and custom views that keep recurring are promoted into tier 1 (ADR-016).
Addendum: [04-interactive-surfaces.md](../04-interactive-surfaces.md).

## ADR-033 - Brand type: Inter for the interface, Newsreader for display

2026-09-25 - Accepted.
Following yaklabs.ai's computed styles, Inter is the interface and body face and Newsreader the display face (headlines, wordmark, thread titles), exposed as `--font-text` and `--font-display` tokens with the site's fallback stacks.
Both are SIL Open Font License fonts bundled from @fontsource with optical sizing, so the desktop app renders them offline; commercial fonts would never be committed, only referenced by name with a free fallback.

## ADR-034 - Brand colour: sampled palette, semantic tokens, one derived green

2026-09-25 - Accepted.
The palette comes from yaklabs.ai's declared CSS: off-white `#f0efea`, ink `#252524`, body copy as a solid `#4a4a47` (about 82% of the ink), a 0.72 ink step for meta text and borders (used here as a solid tint), and the declared sage `#c7cfba` for soft tints; hero-photo greens come from Ethan's Figma picks. (An earlier pixel-sampled pass read body copy as ink at 74% opacity; the CSS showed a solid grey.)
Components use only semantic tokens (`--text-body`, `--line`, `--accent`, `--accent-soft`, and so on), and the UI accent is an olive `#515e38` derived on the declared sage's hue (OKLCH 124°), chosen over a forest-hue green so that buttons, charts, chips, and bubbles share one hue; it passes 6.1:1 on paper and under cream text.

## ADR-035 - Outline button after yaklabs.ai, as a starting point

2026-09-25 - Accepted.
The default text button copies the site's "Apply for this role" button from its computed styles: 14px medium Inter, 10px × 22px padding, 4px corners, and an ink outline at 0.72 at rest, with the fill (forest `#242b24`, measured from a hover recording) and off-white text arriving over a 150ms `ease` transition on hover; the border does not animate.
The site has no delay: the "beat" before the fill is the 150ms duration itself; duration, delay, easing, and colours stay tokens (`--btn-*`) as Ethan's starting point for design iteration.

## ADR-036 - "Show my work", always collapsed by default

2026-09-25 - Accepted.
The toggle that reveals how an answer was produced is labelled "Show my work" (not "Show recipe", which is builder jargon), and it always starts collapsed, on every card, in every context.
Kay's job is to earn enough trust that non-technical users never need to check the steps; the steps stay one click away for anyone who wants them, and are still the source for skill settings (ADR-008, ADR-017, ADR-029).

## ADR-037 - Anything that expands in the thread lands centered, never under the compose box

2026-09-25 - Superseded by ADR-038.
When a card, accordion, or menu inside the thread expands, the thread scrolls so the newly shown content (with the control that toggles it) is fully visible and vertically centered in the visible band above the compose box and any recap overlay; content taller than the band starts at its top, and at the end of the thread it rests flush above the compose box rather than leaving an empty gap.
The thread owns this one rule and components opt in through a `reveal` hook, and jumping to a turn uses the same calculation (ADR-022), so expanding and jumping always frame content the same way.

## ADR-038 - An expanded card rests 20px above the compose box, like the last card

2026-09-25 - Accepted.
When a card inside the thread would be clipped by the compose box (or by the card docked above it), the thread scrolls just enough for the card's bottom to rest 20px above it, exactly where the last card in the thread rests; a card that already fits does not move, one taller than the view starts at its top, and the thread never scrolls up to reveal, because that would move away from the click.
The thread panel enforces this for every component by watching each turn grow right after a click or key press inside it, so no component has to opt in; jump-to-turn still centers its target (ADR-022), because a jump is navigation, not an expansion.

## ADR-039 - "Needs you": a question the agent waits on, separate from the recap

2026-09-25 - Accepted.
When the agent is blocked on the user, it emits a validated question (zod, fails closed) that floats above the compose box as a "Needs you" card with numbered choices after Claude Code's question prompt: the agent's branches, one concrete question answered by typing right in the card, and a way out that the agent may word for the moment ("Chat about a plan to ...") and the host otherwise fills with "Chat about something else", with keys 1 to N and no close button.
Each row asks something different, so the card never asks "what do you want to talk about?" twice.
Every text is at most two short sentences (120 characters, about three lines in the narrow card), labels fit one line, and the typed-answer prompt fits its one-line field; a longer question means the agent needs more context, so it asks in the thread instead (ADR-040).
The recap only reports what happened and never asks for anything, and the question shows as soon as the agent is blocked rather than after idle time, because being blocked is not an idle state; while a question is open, it takes the recap's place.

## ADR-040 - A malformed question goes back to the agent, never to the user

2026-09-25 - Accepted.
A question that fails the schema never becomes a card, not even part of one, and the user never sees the error: the validation error goes back to the agent, which asks for what it needs in an ordinary streamed reply, so a blocked agent is never silently stuck.
A bad question (irrelevant, or offering a path that makes no sense) should never be asked at all, which is the model's and the prompt's job; the schema only guards shape, and generation should be constrained to the same schema so a malformed one is rare.

## ADR-041 - One seam between the thread and whatever answers it

2026-09-25 - Accepted.
The thread only reports events to an `Agent` (the user sent a message, answered a question, or the agent's question was rejected) and renders the reply that streams back as text chunks; it never decides what the agent says.
The scripted lab stand-in (`labAgent.ts`) is the only fake left and is the default, so showing the UI with a real model means passing another `Agent`, with the question schema shared between that runtime and the UI (ADR-040).

## ADR-042 - What needs attention sits on a strong surface

2026-09-25 - Accepted.
The recap and the "Needs you" card use a warm grey, `#62625d` (Ethan's pick), so they stand apart from every card in the thread, which all sit on the light paper; their text flips to cream (5.6:1), with muted text at 90% cream (4.9:1) and a hover that darkens to `#3d423b` (Ethan's pick, the palette's sage) rather than lightening, so text stays well above 4.5:1 (cream 9.4:1); light surfaces keep their own lighter hover.
It is the lightest grey in its family where cream text still passes: `#51534b` felt jarring, and `#8a8a85` failed with light text (3.2:1) and looked disabled with dark text.
The cards redefine the text tokens locally instead of carrying colours of their own, and the olive send key inverts to cream because olive disappears on the grey.

## ADR-043 - A text field primitive with the button's outline

2026-09-25 - Accepted.
Places to type use one shared `.field` class with the outline button's 1px border and 4px corners (ADR-035), so a field reads as part of the same family; surfaces tune it through `--field-*` tokens, and the strong surface is a reusable `.surface-strong` class rather than per-component colours.
In the "Needs you" card, the typed answer uses it, with a placeholder greyer than the statements in rows 1 and 3 so a question to answer is not mistaken for a choice; a faint recessed fill keeps that greyer placeholder at 4.6:1, and the send key sits inside the field's right edge and takes room only once there is text.

## ADR-044 - Focus is a warm mid grey

2026-09-25 - Accepted.
The focus ring, the compose box's focused border, and the focus glow use `#8a8a85` (Ethan's pick), which clears the 3:1 a ring needs on the page (3.0:1) and on cards (3.3:1), replacing the olive accent; the darkest hero green `#161d17` was tried first and read too heavy.
On the strong surface the grey is 1.8:1, so that surface keeps a cream ring (5.6:1), drawn inside tiles so it sits against the tile.

## ADR-045 - "Needs you" is numbered tiles with Skip and Submit, and it folds

2026-09-25 - Accepted.
Choices are tiles a shade deeper than the card (separated by fill, not outlines), each with its number on the left: the number's outline appears on hover and fills solid when selected, and choosing is two steps, select (click, number key, arrows) then send (Enter or Submit), with Skip beside Submit at the bottom right, after Claude's and Amp's question prompts.
The card stays dark so it catches the eye while the app waits on the user, and its header folds it to one line (label, question, chevron), after Amp, so the user can read back through the thread without dismissing the question.

## ADR-046 - Attention surfaces in light and dark mode

2026-09-25 - Accepted.
In light mode, the current mode, the recap and "Needs you" sit on a mid grey `#8a8a85` with the darkest ink `#111411` (5.4:1, since the regular ink is 4.4:1 there), and choices are tiles of `#cbcac4`, darker than the user's bubbles, with dark text (9.3:1); hovers lighten, as on every light surface.
The dark card tried in light mode (`#62625d`, cream text, deeper tiles, sage hovers) is kept as dark mode under `:root[data-theme="dark"]`, switchable from Storybook's toolbar; only the attention surfaces are themed so far.

## ADR-047 - The sage tint means "you", and nothing else

2026-09-25 - Accepted.
The sage-green tint of the user's bubble is reserved for that bubble, so the colour always means "this is what you said"; context chips, badges and tags use the neutral wash instead.
The tokens are named `--bubble-*` so the tint cannot be reused elsewhere by accident.

## ADR-048 - The app surface is the site's own background

2026-09-25 - Accepted.
The app's surface (the thread panel, its cards, and the compose box) uses `#f0efea`, yaklabs.ai's page background, and the window around the app takes the lighter step it used to have (`#f8f8f6`), so Kay reads as the same material as the website.
Text contrast is now measured against `#f0efea`, the darker of the two; everything still passes, with the grey focus ring the closest at 3.0:1.

## ADR-049 - Adopt yaklabs.ai's token names and contrast pattern

2026-09-25 - Accepted.
The core tokens now use the site's own names and values, read from its stylesheet: `--paper`, `--paper-deep`, `--ink`, `--soft-ink`, `--rule` (ink at 72%), `--hairline` (ink at 25%), `--blue`, `--sage`, `--chalk`, `--moss`, `--rust`; colours the site does not declare keep a `--yak-` prefix so their origin stays visible.
The contrast pattern follows the site too: two text inks (headings `--ink`, everything else `--soft-ink`), two line weights (`--rule` for outlines, `--hairline` for borders), `--paper-deep` for hover and inset fills, and `--blue` text selection; this retires our `--muted`, `--line`, `--wash`, and `--text-body`, and corrects `--rule`, which we had at 21%.

## ADR-050 - Where yaklabs.ai and meetkay.ai differ, Kay's own site wins

2026-09-25 - Accepted.
The Design Engineer posting lives on meetkay.ai, Kay's product site, whose stylesheet declares the same token names with some different values; since Kay is the product, its values win.
`--soft-ink` becomes meetkay.ai's `#5c5c57` (5.8:1 on paper) instead of yaklabs.ai's `#4a4a47`, so body and secondary text sit visibly one step lighter than headings, as on the posting; meetkay.ai also declares `--moss: #1d291f` (its filled submit button) and `--error: #9c3b2a`, not yet adopted.

## ADR-051 - Brand colours come only from declared CSS, never from pixels

2026-09-25 - Accepted.
The screen used to sample colours had a blue-light filter, so every colour picked from screenshots or recordings as a brand fact is dropped: the hero-photo greens and cream and the measured button hover fill `#242b24`; this amends ADR-034, ADR-035 and ADR-046.
The button hover uses the declared near-black green `#111411` until the site's hover rule is read from its stylesheet, text on dark fills uses the declared paper `#f0efea`, darker greens are mixed from declared values, and Ethan's warm greys stay as deliberate picks, flagged for a re-check with the filter off.

## ADR-052 - The button's hover is the site's moss, read from its stylesheet

2026-09-25 - Accepted.
yaklabs.ai's rule is `.apply-jump:hover { background: var(--moss); border-color: var(--moss); color: var(--paper) }`, so the outline button now fills with `--moss` `#263b30` (paper text 10.4:1), and its border turns moss too, instantly, since only the fill and text colour are transitioned; this replaces the provisional `#111411` from ADR-051 and the measured `#242b24` from ADR-035.
The button follows yaklabs.ai's `--moss`, not meetkay.ai's `#1d291f` (ADR-050), because it copies that site's button; which moss the product uses elsewhere stays open.

## ADR-053 - The focus ring is for keyboard and assistive focus only

2026-09-25 - Accepted.
Browsers treat every focused text field as keyboard-focused, even after a click, so `:focus-visible` rang a clicked field; `inputModality.ts` now records whether focus last came from Tab or a pointer (`<html data-input>`), and a clicked field or compose box keeps its focused border without the ring.
Tab and assistive tools (no pointer yet) still get the ring.

## ADR-054 - The attention surface: pale card, paper tiles, dark hover

2026-09-25 - Accepted; amends ADR-046.
"Strong surface" is renamed the attention surface (`.attention-surface`, `--attention-*`); in light mode the Recap and Needs you cards are `#d6d5cf` with ink text, rows hover to `#8a8a85` with their text switched to `#111411` (the usual inks fail there), tiles are paper (the old `#cbcac4` was 1.1:1 against the new card), the focus ring inside is ink, and Submit fills with moss on hover.

## ADR-055 - Bars are flat

2026-09-25 - Accepted; supersedes design pillars 10 and 11.
The eased darker base on chart bars did not work with the colour scheme, so bars are one flat data colour with 4px top corners; the bar colour itself is being chosen, and green is reserved for button hovers.

## ADR-056 - The compose box is brighter than the app

2026-09-25 - Accepted.
The compose box uses `#f8f8f6` (`--compose-bg`), one step brighter than the app's paper, so the place to type reads as the nearest, most active surface; the window around the app uses the same colour.

## ADR-057 - Secondary text comes from the site's brand.css

2026-09-25 - Accepted; amends ADR-050 for this token.
yaklabs.ai loads a shared stylesheet, `/brand.css`, whose `--soft-ink` is `#565650`, while its pages override it (`#4a4a47` inline on the homepage, `#5c5c57` on meetkay.ai's careers page); secondary text adopts the brand file's value (6.4:1 on paper).
Only this token changed; the brand file's other small differences (`--hairline` at 24%, no `--rust`) are left as they are.

## ADR-058 - Chart marks are neutral graphite

2026-09-25 - Accepted; completes ADR-055.
Bars, lines and legend keys use `#56564f` (`--yak-graphite`, Ethan's pick; 6.4:1 on paper), so green stays reserved for button hovers; `#252525` read as black and `#c7cfba` failed the 3:1 a chart mark needs and belongs to the user's bubble.
The stepped slider stays olive for now, pending a decision on moving it to ink.

## ADR-059 - Needs you parts from the Recap: paper card, grey pills, a header line

2026-09-25 - Accepted; amends ADR-054 for Needs you.
The Recap is done and keeps the pale attention card; Needs you now sits on the app's paper with its option pills in the attention grey `#d6d5cf` (hover still `#8a8a85`), and a line under its header marks the header as the fold control, with 8px between the header's hover fill and the line; folded, there is no line.
Neither card shows a shadow on its top edge any more; the lift shows only below.

## ADR-060 - Needs you options rest on paper-deep and hover to the attention grey

2026-09-25 - Accepted; amends ADR-059.
Needs you option pills rest on brand.css's `--paper-deep` (`#e4e4df`, one step below the card's paper) and hover to `#d6d5cf`, which is light enough that labels and details keep their usual inks (10.4:1 and 5.0:1); the header and Skip share that hover, and the Recap keeps its `#8a8a85` hover.

## ADR-061 - Submit announces readiness with motion, and fills only on hover

2026-09-25 - Accepted.
Once a choice is made, Submit stays an outline: a second outline fades in from 8px outside and closes onto the border in 450ms, its stroke thinning from 6px to 4px and then to 1px in the last frames, and then it disappears, handing off to the real border so two outlines never overlap, so becoming available is a motion rather than a colour, and the moss fill is left for hover alone; before, a filled Submit and its moss hover were nearly the same.
It is CSS only (a pseudo-element created when `:disabled` stops matching starts the animation), drawn as an inset shadow because border widths snap to whole pixels; under reduced motion the outline simply appears.

## ADR-062 - Five primitives under every surface

2026-09-25 - Accepted.
Disclosure (accordion), Menu (popover), Modal, CardHeader and IconButton are shared primitives with their own Foundations stories, so every surface builds from the same parts: the Needs you fold is a Disclosure, dictation is a Modal, the compose attach and card share menus are Menus, and every card's top is a CardHeader with a flush divider.
The Menu is fixed to the viewport beside its trigger and closes on scroll or resize, because the compose row and cards clip their overflow and would otherwise cut it off.

## ADR-063 - Attach files or a screenshot from the compose box

2026-09-25 - Accepted.
The paperclip opens a menu with "Add images & files" (⌘U) and "Take screenshot"; the screenshot uses the browser's screen-capture prompt (the user picks what is shared), grabs one frame and stops, and attachments ride along with the next message as chips, which can be sent on their own.
The goal is less friction in the feedback loop: showing the agent what you see should take one click, because non-technical people get better results, and enjoy the work more, when showing is easier than describing.

## ADR-064 - Share one card as a public page

2026-09-25 - Accepted.
Every card has a share button that copies a link to, or opens, a standalone page showing only that component, never the conversation; the card travels in the link's fragment (which never reaches a server) and passes the same catalog check before rendering, so a garbled or edited link shows an honest notice, and interactive cards stay interactive.
In the lab the page is `share.html` beside the app, or the Share/Public page story inside Storybook; making it public means deploying either one.


## ADR-065 - Contrast is measured before a colour ships

2026-09-26 - Accepted.
Every colour change is checked in numbers, not by eye: text needs at least 4.5:1, and UI parts and graphics (rings, outlines, chart marks) at least 3:1, measured against every surface the colour touches, including hover, selected and dark mode; a requested colour that fails is flagged with its ratio, and the nearest passing option, before it ships.
Colours that looked fine failed on measurement at least six times: `#8a8a85` with light text (3.2:1, ADR-042), the grey focus ring on the attention card (1.8:1, ADR-044), the regular ink on the `#8a8a85` hover (4.4:1, ADR-046), sage as a chart mark (ADR-058), and olive (2.0:1) and soft ink (2.1:1) on that same hover; taste proposes, numbers dispose.

## ADR-066 - One writer per branch

2026-09-26 - Accepted.
Parallel sessions may read a branch freely, but only one writes to it at a time, and write ownership passes explicitly, in a handoff that names the branch, its head commit and the open PR, so the new writer starts by checking the repo against it.
Two sessions once pushed to the same branch and collided; read-only helpers such as the Figma token watcher never push, so they need no handoff.

## ADR-067 - The question card is labelled "Needs attention" and fills only on hover

2026-09-26 - Accepted; amends ADR-059 and ADR-060.
The label reads "Needs attention" on a yak brown pill (`#d0ae7e`) with near-black brown text (`#3b2612`, 6.8:1), both Ethan's picks, replacing the faint warn colours.
The card has no grey fill at rest: option pills lose their `--paper-deep` rest fill and take it as their hover instead (ink 12.0:1, soft-ink 5.8:1), the `#d6d5cf` hover is gone from this card (the Recap keeps it as its surface), and the header and Skip share the new hover; dark mode is unchanged.

## ADR-068 - The Needs attention pill is caution orange

2026-09-26 - Accepted; amends ADR-067.
The label's fill moves from yak brown `#d0ae7e` to an orange `#d19456` (`--yak-orange`, Ethan's pick) so it reads as caution, not decoration, while the text stays `#3b2612` (5.5:1 on the new fill).

## ADR-069 - Attention cards cast their shadow down and to the right

2026-09-26 - Accepted; amends ADR-059.
The Recap and Needs attention cards' shadow moves 8px right as well as 8px down (`8px 8px 16px -8px`), so it shows equally on the bottom and right edges and not at all on the top or left, as if lit from the top left; before, the right side was barely darker than the surface (5 levels against 19 at the bottom), so the card looked lifted only at its bottom edge.

## ADR-070 - The control you just clicked stays in view

2026-09-26 - Accepted; amends ADR-038.
When a click makes a card taller than the visible thread, the thread still starts the card at its top, unless that would leave the clicked control under the compose box; then it scrolls until the control rests 20px above the compose box, so a toggle such as "Show my work" can always be clicked again to hide.
Before, opening the profit card's steps pushed "Hide my work" beneath the compose box, where a click landed in the text field.
