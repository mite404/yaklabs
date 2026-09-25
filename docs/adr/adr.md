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
When the agent is blocked on the user, it emits a validated question (zod, fails closed) that floats above the compose box as a "Needs you" card with numbered choices after Claude Code's question prompt: the agent's branches, an answer typed right in the card, and a host-added "Chat about something else", with keys 1 to N and no close button.
The recap only reports what happened and never asks for anything, and the question shows as soon as the agent is blocked rather than after idle time, because being blocked is not an idle state; while a question is open, it takes the recap's place.
