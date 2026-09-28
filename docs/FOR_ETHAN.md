# For Ethan

A living log of what we are building, why, and what we learned along the way.

## 1. The Story So Far

We are preparing for a founding design-engineer interview at YakLabs, whose product is Kay: a
desktop AI workspace that turns non-technical knowledge workers into AI power users.
We picked one of the three problems in the posting - making agent work legible - and have been
arguing our way to a set of interaction principles, recorded as ADRs in `docs/adr/adr.md`.
The first code exists: `catalog-lab/`, a React + Storybook experiment where an agent may only pick
from a strict catalog of chart and table cards.
Next: fit those cards into a chat thread panel (ADR-023), then the site of working prototypes.
Ideas we agreed on but have not started live in `docs/LATER.md`.
The thread now keeps every expanded card 20px above the compose box (ADR-038), and a question the
agent is blocked on gets its own "Needs you" card instead of hiding inside the recap (ADR-039).
Every component is now run, not just read: all 40 stories render in headless Chromium with an axe
check on each commit and in CI, beside oxlint, oxfmt, `tsc` and fallow, and a `verify-storybook`
skill lets an agent screenshot whatever a change reaches.
The lab has become an app. The repo is now a pnpm monorepo in Better-T-Stack's layout
(ADR-087): the catalog is a package beside its stories, `apps/web` is the React Router site that
renders the profit thread, `packages/runtime` runs the agent loop and keeps every conversation in
SQLite inside the browser's private file system, and `apps/gateway` is the one Cloudflare Worker
that checks a WorkOS sign-in and streams Claude's reply back without keeping a copy. The moment it
all exists for: the user steps the profit card to net profit, asks "why is Saturday high?", that
choice rides into the model's prompt as `[Card view: Net profit · Sep 14–20]`, and the reply is
about the view they set (ADR-030, ADR-031). Proven in headless Chromium: the reply names the view,
and a reload brings all four turns back from disk. What still waits: a model key in the gateway,
and replies that produce cards, since the seam between thread and agent still carries only text.
The app has a shape now, not just a thread. A rail on the left holds the mark, Thread and Lab, the
theme and the account. Beside the thread sits the compose canvas (ADR-089): a dotted field where a
highlight dragged out of the thread starts a new thread of the same project, with the highlight
quoted in its compose box, and a card dragged by its header opens large in a lane of its own, with
open ground always kept to the right for the next drop. The divider between thread and canvas drags
anywhere along its length. And dark mode is real (ADR-090): the night green page, cream ink, every
ratio measured, where before only the attention cards changed.
Then Ethan used it, and the canvas grew hands. The gap after a lane drags its width, with a hint of
a line that follows the pointer the way JetBrains Air's divider does; a lane's title bar carries
it to another place in the row, a copy floating under the pointer while the lane itself waits
dimmed in the slot it will take, after GitButler; a wheel over the ground pans the row; the open
space says what to drag and offers "Create
blank thread" in the site's own button. And the hand over a highlight learned its manners: it waits
until the highlight is finished, because the I-beam while selecting is a convention older than the
web.
The title bar then became the whole story of a lane: its middle and right take hold of it, with a
six-dot grip fading up to say so, and its far left is the thread's name, which a click turns into
a field. The name is kept in the vault, so the worker learned one more word, `rename`. The canvas
lost its right edge along the way: the ground runs a pane past the last lane, a thin scrollbar
admits it, and the ground drags to pan. And a card pulled out of the thread now rides whole, the
one left behind dimmed, the same pattern as a lane.
Then the app took Kay's shape. The grip no longer cuts a lane's title in half, and the rename field
lost its rule (ADR-097). A card or a highlight now travels by a carry the page draws itself instead
of the browser's drag, so the closed hand holds from lift to release, the canvas lights up, and an
ink line stands in the gap where the drop will land (ADR-091, ADR-102). A thread started on the
canvas is a sub-thread of the main thread beside it, and the sidebar, now shadcn's, lists each
project, its main threads, and every main's sub-threads under a "↳" (ADR-092, ADR-093).
Underneath, the worker owns the whole workspace in SQLite and pushes one snapshot of it after every
write, and the first build's data migrates into schema v2 as a project called "Demo store"
(ADR-099, ADR-100).
Six mock scenarios (`demo`, `empty`, `long`, `loading`, `failure`, `thread-fails`) open from the
address, load the same bytes every time and never touch the device's data, and the title bar says
which one is on screen (ADR-096, ADR-101). And the app draws itself as a desktop window: traffic
lights, one title bar of tabs, and each tab shows its thread alone, beside a simulated browser, or
beside its canvas. A tab you leave keeps its scroll, its draft and its running reply until you
close it (ADR-094, ADR-105). Three package workers and one web integrator built it against one
written contract, a review of the package diffs confirmed twenty findings that were fixed before
the merge, and every lever predicate, P1 to P12, failed on `main` before the work began and passes
now, beside 419 tests.

Then the shell got its costume. Ethan sent three mocks as style direction: a deep green title bar,
an oil-painting variant of it, a coloured trim, the window floating inside the browser, a
line drawing on the empty canvas, and Kay the yak. The structure stayed; only the look moved. The
bar is green chrome in both themes, with cream on it and a cream pill for whatever is selected
(ADR-110). The window sits 16px in on a warm desk of its own (ADR-111), framed by an olive trim
(ADR-112). An empty canvas shows a splash, a sphere on a desk stand drawn as a mask, with Kay at
the bottom right (ADR-113), and Kay's face is the avatar when nobody is signed in (ADR-114). The
bar can also be painted, from a painting the repo generates itself (ADR-115). Every one of those is
Proposed, with its open question listed for Ethan, and a lever of eleven predicates, A to K,
measures each against a baseline shot on the commit before the polish.
On a phone the bar then had no room for its own tabs. Below 768px it is now two rows, after
Amp's phone layout: a top row that never scrolls, with the project's name and a "⋯" for the thread
and project, and below it the views, Thread, Browser and Canvas (ADR-116); P13 holds 390, 520 and
767 to that. The phone's sidebar no longer covers the page: like Amp's, it slides in from the left
and pushes the whole window aside, leaving the page's edge as the way back (ADR-121). Ethan then
settled the phone: the row of views wins over a row of tabs (ADR-116 over ADR-120), the account
moves from the bar to the foot of that drawer, and the canvas becomes somewhere to look rather
than arrange (ADR-122). On a phone, dragging a lane sideways fought the row's own sideways scroll,
so the drag is simply off there, and the lanes still scroll. One fact decides all three: the
sidebar's own `isMobile`, the same 768px line the styles use.
The title bar's pill is gone. It once said "Mock: demo", "On this device" or "Not saved", and
"· Live model" when one answered - Ethan's call was that the pill added noise without a real
plan behind it yet, so it and the logic behind it are deleted outright, not just hidden
(ADR-123, amending ADR-096 and ADR-116). He may ask for a delineation again once there is
something worth delineating.
A main thread's fold arrow then moved to sit beside its own name, matching the project row's. The
count of sub-threads ("^ 2") went too, then came back at Ethan's word as a plain number at the
row's far right: a caption, not a second fold control. An open fold's "v" now fades the moment
the pointer leaves, since a clicked button keeping focus had held it up. A phone, with no hover,
always shows an open fold's "v". And the sidebar lists threads by when they were made, newest
first, children too, so opening one never moves it (ADR-125).
The row keeps a stretched link (Bootstrap's own pattern) so a click anywhere on it still opens the
thread, with the fold button lifted above that layer so it still catches its own clicks (ADR-093,
amended by ADR-124).

Every thread then got its own "⋯": the thread actions menu (ADR-126). Six verbs, in the order
Ethan set: Copy thread URL, Share thread, Pin thread, Snooze, Archive, and Delete below a rule.
Pin lifts a thread to the top of its own list and puts a pin in its title bar that is also the
way to unpin (ADR-127). Snooze asks "When should this thread come back?" on the same ask card the
agent uses, keeps the thread in place with a clock before its title, and rings the bell when it
wakes (ADR-128). Archive settles a thread to the bottom of its list, dimmed, behind a closed
filebox, and a thread nobody touches for 14 days now settles there by itself (ADR-129). Delete
hides at once and offers Undo for ten seconds instead of asking "are you sure?" (ADR-130). And
Share, after Ethan's reminder that this is an app about privacy, makes a thread public only for
a length of time you pick, 1 hour to 7 days, sealed on your device so the server holds a locked
box it has no key to (ADR-131).

Then the canvas got busy. It keeps cards and child threads side by side so Ethan can refer back
without scrolling, but six open lanes leave room for about one. Following GitButler's collapsible
stacks, any lane now folds to a 32px strip: its expand at the head, the six-dot grip always
showing, and the title turned to read top to bottom. The whole strip drags, and the fold is kept
with the lane in SQLite, so it survives a reload (ADR-133, schema v4). A first mock put Collapse
all at the start of the lane row; Ethan moved it into the title bar, beside the layout on a
desktop and in the phone's top row, and moved each lane's own toggle into the thread's or card's
title bar, inside the thing it folds (ADR-134).

Then the empty canvas got a splash Ethan actually asked for. The first one had put a stand-in
line drawing and Kay the mascot there, both lifted from a mock; he had wanted neither. Six looks
were built in parallel on six branches, three on his Atlas figure and three on his oil painting,
each measured for contrast and shot in both themes, and he kept three: the landscape and an
abstract painting clearing to paper behind the words, and Atlas alone with his globe ringing
them. A floating debug button at the window's corner flips between them until he chooses
(ADR-135).

Then Ethan got into Kay's shipped app and the picture sharpened. A new thread now opens the way
Kay's new tab does: the mark, the date, a greeting for the time of day, the projects and the
actions a thread can start with, over one of his paintings cleared to paper behind the words. The
empty canvas became his composed surface, a raised sheet with the dots, Atlas and his construction
lines, and the coloured trim around the window turned out to be a Figma selection outline caught
in a screenshot, so it went (ADR-136).

## 2. Cast & Crew

The first entries are ideas from before any code existed; the rest are parts of the running app.

- **The compose box** is the teleprompter: it never moves while the anchor reads (ADR-003).
- **The skill chip** is the slate clapped at the top of a take: proof of what is rolling before
  anyone acts (ADR-009).
- **Hold-to-ship** is the director's "and... action": tap to set up the shot, hold to roll with the
  usual settings (ADR-010).
- **Pins** are picture lock: the cut you like is frozen while everything else keeps moving
  (ADR-012).
- **The redline** is the script revision page: struck lines out, new lines marked, nothing silently
  replaced (ADR-013).
- **The component catalog** is the show bible: it makes a thousand guest directors produce one show
  (see Director's Commentary).
- **The web app** (`apps/web`) is the theatre: the one room the audience sits in, with the thread
  on stage and sign-in at the door (ADR-083, ADR-084).
- **The runtime worker** (`packages/runtime`) is the production office behind the stage. It keeps
  the call sheets (the conversation store) and runs the shoot (the agent loop); the stage only
  passes notes through one door, and each note is checked on both sides (ADR-076, ADR-086). It also
  keeps a thread's name: a rename in the header goes to the worker, which answers as it does an
  open, with the conversation as it now is.
- **The gateway** (`apps/gateway`) is the stage door and the runner. The guard checks every pass
  against the list WorkOS publishes (its signing keys); the runner carries the pages to the
  writers' room (Claude), relays each line back as it is spoken, and keeps no copy (ADR-085).
- **The Storybook app** (`apps/storybook`) is the screening room: every card and panel plays there
  alone, under the same lights, before it goes on stage.
- **The ui package** (`packages/ui`) is the paint shop: shadcn primitives mixed only from Kay's
  tokens, so anything an agent builds comes out in the house colours (ADR-082).
- **The rail** was the corridor outside the theatre: the mark on the door, one icon per room, and
  at the far end the light switch and the cloakroom. It is now the sidebar folded to 56px, and it
  keeps only the rooms: the Kay mark, drawn from the polygon meetkay.ai declares (ADR-095),
  Documentation and Lab. The light switch and the cloakroom moved into the account menu at the
  title bar's far right.
- **The compose canvas** is the cutting-room wall: pull a line out of the thread and pin it up to
  start a new cut, drag a card over to see it at size, and there is always bare wall to the right
  for the next idea (ADR-089). The pins move: take a lane by its grip and the others shuffle
  along, and the gaps between them are handles that set each lane's width. The canvas model
  (`apps/web/src/canvas.ts`) does the arithmetic of where a carried lane lands, and the surface
  (`components/canvas.tsx`) only measures, listens and draws.
- **The workspace snapshot** is the call sheet. After every write the production office (the
  worker) prints one fresh sheet with every project, thread, lane and open tab on it, and the stage
  reads only the latest one (ADR-099). The sheet carries no dialogue. A pane asks for its thread's
  turns with `open` when it shows them. Every note the stage sends carries a ticket number (a
  `requestId`), and the office answers by that number, so one refused note never voids anyone
  else's.
- **The carry** (`packages/catalog/src/carry.ts`) is the props runner. It picks a piece up, walks
  it across the set plainly in hand, and sets it down on its spike mark. The closed hand is the
  "in hand" signal and holds the whole way; the canvas lighting up is the marked floor, and the ink
  line in the gap is the spike tape (ADR-091). Escape, the window losing focus, or a lost pointer
  puts the piece back on the prop table, and nothing lands.
- **The shell** (`apps/web/src/shell/`) is the edit suite. The rounded window with its traffic
  lights is the monitor (ADR-094). Its tabs are sequences open in an editing app. Switch away and
  the other sequence keeps its playhead, because every tab stays mounted, hidden with `inert`,
  until you close it (ADR-105). The layout switch (Thread, Browser, Canvas) is a workspace preset.
  The sidebar is the bin panel. Projects are bins, main threads are sequences, and sub-threads sit
  indented under their main like subclips (ADR-092, ADR-093).
- **The scenarios** (`packages/runtime/src/scenarios.ts`) are test reels. Each one plays on a
  spare projector (a SQLite store in memory), never from the vault's masters (the device's
  database), with a burned-in timecode (a stopped clock and ids that count up), so every screening
  is frame-identical. The marker in the title bar is the slate that says what you are watching:
  "Mock: demo", "On this device", or a live model (ADR-096, ADR-101).

- **The chrome** (`.chrome-surface` in `packages/catalog/src/tokens.css`) is a lighting gel on the
  title bar. The actors keep their blocking and their costumes (every shadcn primitive, every
  accessible name); the gel changes what colour the light is inside that one frame. Ink turns
  cream, the hover fill turns to cream at 8%, the focus ring turns cream, and the active tab and
  the pressed layout step into a cream spotlight, the pill (ADR-110). Menus open in portals,
  outside the gel, so they keep the page's light.
- **The splash** (`OpenSpace` in `apps/web/src/components/canvas.tsx`) is a title card on an empty
  stage. It holds until the first actor walks on (a lane lands) and returns when the stage is
  bare again. Kay stands in the corner like a mascot on a studio lot, and the drawing behind the
  words is a stencil, a mask the ink shines through, so it re-lights for dark mode on its own
  (ADR-113).
- **The collapsed strip** (`LaneStrip` in `apps/web/src/components/lane.tsx`) is a collapsed
  track in the timeline. Premiere lets you fold a track to a sliver that still shows its name, so
  the edit stays in view without its thumbnails eating the screen. The strip is that sliver: the
  track's name runs down it, the grip says it can still be dragged to another slot, and the clip
  inside is only hidden, not unloaded, so a half-typed draft is there when it unfolds (ADR-133).
- **Collapse all** (`apps/web/src/shell/collapse-all.tsx`) is the "collapse all tracks" button
  on the timeline's header, not on any one track. It reads the room first (`foldOffer` in
  `apps/web/src/shell/state.ts`): collapse while any lane is open, expand once none is, and wait,
  greyed out, while the canvas is off screen (ADR-134).

- **The thread actions menu** (`apps/web/src/shell/thread-actions-menu.tsx`) is the slate
  clapper each shot carries: one per thread, clipped to the thread's own title bar, and on a
  phone to the one bar there is (ADR-126). What it writes goes to the runtime as a `mark`,
  `delete` or `share` command, so the sidebar, the title bar and the menu all read the same
  marks from the next snapshot.
- **The settler** (`packages/runtime/src/settle.ts`, run by `settler.ts`) is the night-shift
  script supervisor. Nobody calls it for a scene; it walks the set after every take and on a
  timer, wakes the snoozed threads that are due, files away mains idle for 14 days, and sweeps up
  deleted ones once Undo can no longer bring them back (ADR-129, ADR-130).
- **The share vault** (`apps/gateway/src/shares.ts`) is a film vault that takes sealed canisters
  it cannot open. The page seals the thread and keeps the key in the link's `#`, which browsers
  never send, so the vault stores a locked box with a destruction date stamped on it (KV's TTL)
  and a hash of the receipt that lets its owner pull it early (ADR-131).

## 3. Behind the Scenes

- **Legibility over the other two problems.** It is the product's core promise and it shows timing,
  hierarchy, and progressive disclosure directly.
- **Plain-language skill matching over `/` commands.** A slash command asks a non-technical person
  to learn syntax; plain words plus a chip give the same confirmation without the exam.
- **Autosave inside Kay, deliberate actions outside it.** Saving is never the user's job;
  consequences always are.
- **TanStack versus shadcn is not either/or.** One is the engine, the other is the paint job; what
  keeps agent-built UI coherent is the catalog above both (see `docs/03-generative-ui-research.md`).

- **"Show my work", not "Show recipe", and always closed.** "Recipe" is our word, the builder's
  word; a teacher's "show your work" is the user's. It starts collapsed on every card because the
  goal is trust: like a finished cut, the audience watches the film, and the edit decision list
  exists for whoever asks (ADR-036).

- **Nudge, don't center.** Centering an opened card (ADR-037) moved the frame even when nothing was
  hidden, and every component had to remember to ask for it. Now the thread only moves when a card
  would be clipped, and only far enough to rest 20px above the compose box, the same line the last
  card rests on (ADR-038).
- **The recap reports; it never asks.** A "Needs you" line inside the recap mixed two jobs, "here is
  what happened" and "I need a decision", and hid the decision behind ten idle minutes. A blocked
  agent now asks right away in its own card, with numbered choices and a "Chat about something else"
  exit, and the recap goes back to reporting (ADR-039).

- **A malformed question is the agent's problem to fix, not the user's to see.** When the card's
  check rejects a question, the error goes back to the agent, and the agent simply asks in plain
  words, streamed like any reply. The card either shows complete or not at all, and the user never
  reads a validation error (ADR-040).

- **Two short sentences, or it isn't a card.** Four rows only look considered if each one is brief,
  so the question and every detail are capped at two short sentences (120 characters, about three
  lines in the narrow card, measured). A question that needs more words is really the agent needing
  more context, so it asks in the thread instead. The caps come from the layout, not a guess: 48
  characters per line, 43 in the one-line answer field.

- **The UI reports; the agent decides.** The panel used to hold three canned replies of its own. Now
  it only tells an `Agent` what happened and streams back whatever it says, so the same components
  can run against the lab stand-in today and a real model for the demo (ADR-041).

- **Copy the scaffold, then take out what fights the design.** Better-T-Stack scaffolded only the
  frontend; Varlock (an env codegen step), the server entry and `next-themes` did not survive,
  because the app parses its settings once with zod, renders no server, and React 19 refuses the
  inline script `next-themes` needs. Fourteen of seventeen generated shadcn components went too:
  nothing imported them, and `shadcn add` restores any in seconds (ADR-087).
- **Kay's stylesheet sits in its own cascade layer.** `tokens.css` styles bare buttons, links and
  headings. Unlayered it would beat every Tailwind utility on a shadcn primitive; below preflight
  the catalog's own look would reset. So it loads in a `catalog` layer between the two.
- **Save the line before the take.** The worker writes the user's message to disk before the agent
  answers, so a failed reply never loses what the user typed; the reply is saved when it ends, or
  when the user stops it, with whatever streamed so far, which is what the screen showed.
- **Pass the reel through; don't re-edit it.** The gateway streams the SDK's own events, one JSON
  object per line, and the browser rebuilds them with the same SDK
  (`MessageStream.fromReadableStream`). A format of our own would need a second decoder, kept in
  step with every block type Claude adds; passing the reel through means the projector already
  reads it.
- **Check at both doors.** The worker checks every command, and the page checks its own before
  sending. A malformed command (say, an empty token) then fails where it was made, instead of
  arriving as an `error` nobody can match to a call.
- **Nothing environment-specific in the Worker's config.** Both bindings live in the Cloudflare
  dashboard, the key as a secret and the client id as a variable, with `keep_vars` on so a deploy
  keeps them. A value named under `vars`, even an empty placeholder, would replace the
  dashboard's on every deploy.
- **A failed reply ends in plain words.** The gateway can answer 401 or 5xx. The thread now ends
  such a turn with one sentence and stops the streaming state, and the cause goes to the console,
  never the thread (ADR-040).

- **A question to answer should look like a place to type.** In the "Needs you" card, row 2 looked
  like a third statement. It now uses a new text-field primitive with the button's outline and 4px
  corners, and a greyer placeholder, so "answer me" never reads as "pick me" (ADR-043).

- **Choose, then confirm.** The "Needs you" card used to send the moment a row was clicked. Now a
  click, number, or arrow only selects (the number fills in), and Enter or Submit sends, with Skip
  beside it, the way Claude and Amp ask questions. The header folds the card to one line so the
  thread above stays readable (ADR-045).

- **Speak the site's language.** Our tokens now carry yaklabs.ai's own names and values (`--paper`,
  `--ink`, `--soft-ink`, `--rule`, `--hairline`, ...), read straight from its stylesheet, and follow
  its pattern of two inks and two line weights. Anything the site doesn't declare is prefixed
  `--yak-`, so you can tell at a glance what is theirs and what is ours (ADR-049).

- **Primitives before polish.** Disclosure, Menu, Modal, CardHeader and IconButton now sit under
  every surface, each with its own story, so a new card or panel is assembled rather than invented
  (ADR-062). The attach menu (with a real screenshot) and the card share menu are the same Menu.
- **Share the view, not the chat.** Each card can become a public page on its own; the card rides in
  the link and is validated again on arrival, so the catalog's safety travels with it (ADR-064).
- **Taste proposes, numbers dispose.** The eye adapts to whatever it is looking at, so a colour that
  feels fine can still be unreadable; a cinematographer trusts the light meter, not the monitor.
  Every colour is now measured against each surface it touches, hover included, and a failing pick
  is flagged with its ratio before it ships (ADR-065).
- **One editor holds the cut.** Anyone can watch the dailies, but only one editor works on the
  timeline at a time, or two people's changes overwrite each other. Parallel sessions read the
  branch freely; one writes, and handing over the branch is an explicit handoff with its head commit
  and open PR (ADR-066).
- **Fill is for the hand, not the rest.** The question card's options used to sit in grey pills even
  when nobody touched them, so the card looked busy before it was read. Now it rests on plain paper
  and a row fills only under the pointer, like a spotlight that follows the actor instead of
  lighting the whole stage; its label says "Needs attention" on a caution orange pill, warm like a
  yellow card rather than red like a stop (ADR-067, ADR-068).

- **One set of house rules at the root.** oxlint, oxfmt and fallow install once at the repo root,
  with `catalog-lab` as an npm workspace, so the next app inherits the same rules instead of
  copying them. Like one colour pipeline for the whole show, not one per episode.
- **Gate on what this change did, not on the whole history.** `fallow audit --base HEAD` fails
  only on findings a commit introduces; the older backlog is reported but never blocks. A gate
  that blocks unrelated work gets skipped with `--no-verify` within a day.
- **Vitest 4, on purpose.** Storybook's stable test addon supports Vitest 3 and 4; only a
  Storybook 11 alpha accepts 5. Stable tools under the proof layer beat the newest version.
- **Read the fine print; it is the architecture diagram.** Kay's legal pages say more about its
  build than any tech-detection plugin: the DPA names the hosts (Fly.io, Cloudflare), the database
  (Postgres), the app data folder, and the rule that conversations never leave the device. The slice
  follows that rule (ADR-075) and mirrors the process split, with a Web Worker as the daemon's
  stand-in (ADR-076). The reference lives in `docs/05-kay-stack-and-data.md`.

- **The slice is a location shoot, not a studio build.** Kay's app is a desktop "studio" with a
  daemon backstage; the web slice recreates the same blocking on location: React Router as a static
  single-page app for the stage (ADR-083), a Web Worker as the daemon backstage, owning the agent
  loop and SQLite in the browser's private file system (ADR-081), WorkOS at the door (ADR-084), and
  one Hono Worker on Cloudflare as the gateway that holds the keys and keeps nothing (ADR-085,
  ADR-086). Every piece maps to a part of Kay, so moving to their stack is recasting, not rewriting.

- **A hand that never lets go, at the price of other apps.** In an HTML5 drag the operating system
  draws the cursor and the browser ignores every CSS `cursor` rule until release, so no stylesheet
  could keep the closed hand. The page now draws its own carry. The cost is that a card can no
  longer be dropped into another app, which only ever received its title as plain text. Ethan
  took that trade, because an arrow that comes back mid-drag reads as unfinished in a design
  engineering interview, and the Share link stays the way to take a card elsewhere (ADR-091).
- **One writer, one snapshot.** Four runtime designs were drafted side by side. The judge picked
  the one with the smallest surface, though another scored a point higher (ADR-099). The page sees
  one state and five verbs (`open`, `create`, `rename`, `arrange`, `agent`), plus `saveShell` for
  the tabs, and the worker pushes the whole workspace after each write, skipping a push that
  changes nothing. The old runtime matched answers to calls by kind and order, so one `error`
  notice failed every open and every list still waiting. Now each command carries a `requestId`
  and only its caller hears the answer. And because the pushed snapshot is the truth, a rename or
  an arrange can show at once as an overlay; the next push replaces it, so a refused edit rolls
  back with no undo code at all.
- **shadcn's Sidebar, not a hand-made tree.** It arrived with the icon rail (its
  `collapsible="icon"` state is the old 56px rail), the toggle with its ⌘B or Ctrl+B shortcut,
  skeleton rows, row actions and nested sub-menus. The first four are in use as they came. The
  loading scenario's rows are `SidebarMenuSkeleton` at fixed widths, and the "+" beside a project
  is a `SidebarMenuAction`. Each would otherwise have been a primitive to build, style and make
  accessible by hand, and AGENTS.md already says new components come from shadcn. The project rows
  follow Conductor's: "name >" when folded, and no chevron on an open one until the pointer is on
  it (ADR-093).
- **Scenarios write through the store, never around it.** A fixture poured straight into the
  page's state could show something the app can never reach, such as a grandchild thread or a lane
  on another main's canvas. Each scenario fills a fresh in-memory SQLite through the store's own
  calls instead, so the checks and triggers that guard the device refuse a bad fixture at load
  (ADR-100, ADR-101). The clock is stopped, ids count up and turn times are in UTC, so two loads
  are the same bytes. Loading and failure are data too, `start: "hold"` or `{ fail }`, never a
  timer, so a screenshot of the loading state never catches it halfway.

- **A cream pill, not a paper one, for "selected" on the bar.** The brief suggested the page's own
  paper for the active tab, so the tab would echo the content below it. In dark mode that paper is
  1.63:1 against the green, too faint to say "selected", and a pressed layout needs a fill that
  clears 3:1. Cream clears 8.98:1 in both themes, and it is the light paper anyway, so light mode
  looks exactly as suggested. The bar is now one picture in either theme, which a lever checks
  byte for byte (ADR-110).
- **A painting the repo makes, not one it borrows.** The mock's painting is a crop of an image
  whose source and licence nobody has yet. `paint-chrome.mjs` paints one from seeded noise, misty
  ground and tree canopies, identical on every run, 3 KB, with no pixel of the shipped file above
  luminance 0.10.
  It is ours to ship today, and when Ethan names the painting he wants, it goes through the same
  clamp (ADR-115).
- **A stencil, not a picture, for the splash drawing.** A drawing shipped as an image shows its
  own bounds (the mock does, as a faint rectangle) and needs a second copy for dark mode. As a CSS
  mask filled with `--splash-line`, only the strokes exist, and the ink's own theme colours them.
  The Atlas figure in the mock was too soft to trace, so the stencil is an original sphere on a
  stand until the source file comes (ADR-113).
- **A column for the fold, not a corner of someone else's record.** Whether a lane is collapsed
  could have lived in the shell document, which needs no migration. But the shell is the page's
  scratchpad and would remember a fold for a lane that was since closed, and folding it into
  `width` (say, a negative width) gives one column two meanings. It is a `collapsed` column, 0 or
  1, added by schema step 3 to 4, which starts every existing lane open. The 1 to 2 step keeps its
  own insert with only the columns v2 had: a finished migration never changes (ADR-133).
- **A slot in the catalog's headers, not a button floated over them.** The toggle could have been
  positioned from the lane over the header's left edge, touching no catalog file. It would have
  been tied to each header's padding and height, and to both the thread's bar and the card's. A
  `leading` prop on `CardHeader`, `CatalogCard`, `InteractiveCard` and `ChatThreadPanel` lets the
  host hand in the control; the catalog lays it out and still owns its headers (ADR-134).
- **The query picks the bar, and storage keeps it.** The app's links keep only `?scenario=`, so
  `?chrome=painting` would vanish on the first click. Rather than teach every link a second
  parameter, the page reads it once and stores it, the way the sidebar remembers open or closed.

- **Undo, not "are you sure?".** A confirm dialog before every delete teaches people to click
  through it, so it guards nothing. Undo catches the slip after the fact: the thread is only
  marked deleted in SQLite (a tombstone) for ten seconds, and a settling pass removes it for good
  afterwards (ADR-130).
- **A sealed box with a clock, not the thread in the link.** A card's share link carries the card
  itself (ADR-064), but a link has no way to stop working: whoever holds it holds the data
  forever. Ethan wanted how long a public page lasts to be explicit, so the ciphertext lives on
  the gateway with a KV TTL and dies on schedule, while the key stays in the fragment, where the
  server never sees it (ADR-131).
- **One pure plan for everything that happens later.** Snoozes waking, idle threads archiving,
  tombstones purging and shares expiring are all "things due at a time". One function,
  `planSettle`, takes the rows and the time and returns what to do and when to look again, so
  every rule is tested as data with no clock, and one timer serves them all (ADR-129).
- **The contract re-exported, not imported across.** The web app needed the gateway's share
  contract, but the gateway's build already packs the web app's build, so a direct dependency
  made a loop Turbo refuses. The runtime, which both sides already use, re-exports it (ADR-131).
- **A dim ink chosen by calculation.** "Dimmed" is easy to overdo until the title fails
  contrast. `--faint-ink` was computed to sit visibly under soft ink yet still clear 4.5:1 on both
  papers in both themes (ADR-129).

## 4. Bloopers

- **The matte that cut nothing.** Ethan's Figma mask group hid the landscape's gradient instead
  of using it: the layer set as the mask was a solid rectangle at 78%, so it cut the painting to
  a flat 78% everywhere, and the gradient rectangle sat under it, hidden, masking nothing. A
  Figma mask is the bottom layer of its group and cuts everything stacked above it, so the fix
  was layer order: make the gradient the mask and delete the solid one. Lesson: a matte is a
  plate, and it goes in first.
- **The gate the first branch tripped.** CI's fallow audit fails any function whose CRAP score
  (complexity times untested lines) reaches 30, and `OpenSpace` sat exactly on that line, so the
  one conditional the first splash option added turned CI red. Fix: the splash's pieces live in
  their own small components, and the look is chosen in CSS off an attribute on `<html>`, so
  `OpenSpace` gained nothing at all. Lesson: a component sitting on a threshold is a load-bearing
  wall; hang new things on a frame of their own.
- **The row that ran from the cursor.** A main's children were listed in the canvas's lane
  order, open lanes first. Clicking a closed child's row reopened its lane, which promoted it to
  the open group, so the row slid up one slot the instant it was clicked, and the pointer was
  left over its neighbour. Opening a thread by a plain click never showed it; only a child whose
  lane had been closed did. Fix: the sidebar orders by creation alone (ADR-125), and web-check
  closes both lanes, clicks the second row and checks it has not moved a pixel. Lesson: a list
  people click must not be sorted by anything the click itself changes, like a shot list that
  reshuffles whenever you call "action".
- **The empty seat saved for a count.** Dropping the "^ 2" count from a main thread's row left
  the chair it sat in. shadcn pads a row 32px at its right whenever its list item holds an action,
  and the project's "+" shares its item with every thread below it, so each thread row kept a
  32px gap for a count that no longer existed. "Service desk weekly review" cut to "...revi..."
  with room to spare. Every test passed; only comparing screenshots with main's showed the titles
  ending early. Fix: each thread row takes that room back, and web-check reads every row's right
  padding. Lesson: when you strike a prop from a scene, check the blocking tape it left on the
  floor.
- **The `false` that still said yes.** The phone's canvas hid its drag grip behind a
  `[data-reorder]` selector, and the row set `data-reorder={reorderable}`. React writes a `false`
  data attribute out as the string `"false"`, so the attribute was present on a phone too, and a
  tap still drew the grab hand and the six dots. The test passed anyway, because it only checked
  that nothing lifted. Fix: select `[data-reorder="true"]`, and make the test read the grip
  itself (the cursor, and whether the dots are drawn at all). Lesson: a test named "the grip is
  not shown" has to look at the grip.
- **Two Escapes, one key.** With the account menu open inside the phone drawer, Escape closed
  both. Both listen on the document; the drawer's listener was added first, when the drawer
  opened, so it ran before the menu could claim the key, and checking `defaultPrevented` could
  not help. Fix: the drawer leaves an Escape that comes from inside an open menu to the menu.
  Lesson: when two layers share one key, decide who owns it by where the key came from, not by
  who happened to subscribe first.
- **The rulebook with a missing chapter.** The first oxlint config listed five plugins. In oxlint,
  a `plugins` list replaces the defaults instead of adding to them, and `eslint` was not on the
  list, so core rules like `no-unused-vars` never ran and the output looked clean. Lesson: an
  empty report proves nothing until you know what was switched on.
- **The installer that dropped the unit tests.** Adding Storybook's test addon wrote a Vitest
  `projects` list with only the story project, so the 69 unit tests would silently stop running.
  Caught because the count was checked: 109 tests (69 unit plus 40 stories), not 40.
- **The screenshot shot mid-dissolve.** The first proof capture of the "Needs attention" card came
  out washed out, because the card fades in and the camera fired during the fade. Fix: wait for
  fonts and finish animations before each capture. Lesson: evidence of a fade-in must be the last
  frame, like grabbing a still after the dissolve, not during it.
- **The modal that never took focus.** Driving the modal in a real browser showed focus staying on
  the button that opened it, so Escape did nothing until you tabbed in. Reading the code had
  suggested a working focus trap; only running it showed the trap had no one inside.

- **The docs were behind a locked door.** The environment's network policy blocked docs.meetkay.ai,
  so Kay's vocabulary was reconstructed from search snippets and Ramp's Glass. Everything inferred
  is labeled; verify before the interview.
- **The push that was not a network problem.** GitHub was reachable, but the Claude GitHub App was
  not installed on the repo, so pushes returned 403. Network allowlist and repo permission are two
  different gates.

- **The screenshots that looked like a phone.** Review captures were taken at 2x pixel density,
  tightly cropped around a 707px panel, so a desktop column read as a mobile app. They also hid a
  real bug: a fixed 720px panel height clipped the compose box in Storybook's preview. Lesson: judge
  UI at 1x, in a realistic window (1440x900), with its surroundings visible, because scale is only
  legible in context.

- **Two tapes labelled "recap" and "RECAP".** `recap.ts` (rules) and `Recap.tsx` (component) sat in
  one folder. Linux treats them as different files, so every check passed in the cloud container;
  macOS ignores letter case by default, so `import "./Recap"` found `recap.ts` first and Storybook
  broke on Ethan's machine. Fix: rename to `recapRules.ts`, plus a test that fails if two modules
  ever differ only by case. Lesson: never let file names differ only by capitalization, and turn a
  bug into a guard, not just a fix.

- **The screenshot that was a rerun.** Figma's screenshot service showed Sunday's bar at about 18px,
  while the live file said 119px. The live file was right (Sunday's gross profit is about $8.6k);
  the render was from an older save. Lesson: when two views of one thing disagree, check which is
  the source of truth before blaming the edit.

- **A card that needed a window to exist.** The first test to render the interactive card outside a
  browser crashed, because it read `window` during render to check reduced motion. Kay is a desktop
  app, so users would never hit it, but a component should not assume its stage. Fix: guard the
  check and return the default.

- **The accordion that opened offstage.** Opening "Show my work" grew the card downward while the
  scroll position stayed put, so 140 to 170px of the steps landed below the visible edge, behind the
  compose box, from every starting position. When the view did sometimes shift, that was the
  browser's scroll anchoring guessing, not a rule. Fix: the thread owns one reveal rule (ADR-037).
  Lesson: when something expands, decide who moves the camera; if nobody does, the browser will,
  inconsistently.

- **The rule that only one card followed.** ADR-037 asked each component to call `reveal`, and only
  the interactive card did, so "View data table" still opened 31px under the compose box beside a
  split pane. Fix: the thread panel enforces the rule itself by watching every turn grow after a
  click (ADR-038). Lesson: a rule that depends on every component remembering it is a suggestion;
  put it where nothing can skip it.

- **The typecheck that ran a package install.** `react-router typegen` hung Turbo for eleven
  minutes. React Router 8 installs `isbot` by itself when a project lacks it, and the install it
  spawned could not reach the registry through the proxy. Fix: keep `isbot` as a dependency and
  tell fallow why. Lesson: a hang in a type check is rarely the type check; read what the tool
  does before it checks anything.
- **The example config that was linting the repo.** After the move, oxlint reported rules nobody
  had turned on. It had found an example `.oxlintrc.json` under the vendored skills and applied it
  as a nested config. Fix: nested configs off, and ignore patterns that cover the whole vendored
  tree. Lesson: a file that looks like config is config to any tool that walks the tree.
- **The hook path that pointed at a ghost.** A throwaway worktree of `main` ran the old
  `prepare: husky` script, which wrote an absolute `core.hooksPath` into the shared repo config.
  Git ran no hook on any commit for an hour; every gate ran because someone ran it by hand. Fix:
  `pnpm install` reinstalls Lefthook with the hooks path reset, so the setup converges on its
  own. Lesson: when a hook is silent, check where git is looking before checking the hook.
- **Two `--accent`s.** shadcn's `--accent` is its hover fill; Kay's `--accent` was the olive on the
  slider. Loading both stylesheets would have turned the slider grey. Kay's became `--olive`
  before the bridge was written, with `--radius` becoming `--radius-card` for the same reason.
  Lesson: before mapping two vocabularies, list the words they share.
- **The script React refused to run.** `next-themes` prevents a flash of the wrong theme by
  rendering an inline script; React 19 logs an error when a client-rendered component contains
  one. A fifty-line theme module now sets `data-theme` on the root and boots the stored theme
  from the prerendered shell's head instead. Lesson: a library built for server rendering can
  carry assumptions a single-page app cannot meet.
- **The radio that swallowed a text field.** The "Needs attention" card's typed-answer row was a
  `div role="radio"` wrapping an `input`, so axe failed two stories on nested interactive
  controls. It is now a `<label>` around the field: a click anywhere focuses the field, whose focus
  selects the row, and the other rows carry their position and count so "3 of 3" still reads.
  Keyboard behaviour and pixels are unchanged. Lesson: a role is a promise about what is inside.
- **The build that waited for itself.** The Worker ships the web build as its assets, so its build
  must run after the web build. Saying so made Turbo report a cycle: the web app depends on the
  runtime package, the runtime lists the gateway (only for its types), and every build waits for
  its dependencies' builds. Nothing needed the gateway built first; the edge existed only on
  paper. Fix: the runtime's build waits on nothing, with a comment saying why. Lesson: needing
  someone's types is not needing their build, like a call sheet that makes the editor wait for the
  premiere.
- **The setting every deploy would have erased.** The first plan put the WorkOS client id in the
  Cloudflare dashboard while `wrangler.jsonc` held an empty placeholder. Cloudflare's docs say
  each `wrangler deploy` replaces dashboard variables with the config's, so every deploy would
  have blanked the id and broken sign-in. Caught by reading the docs before shipping. Fix: no
  variables in the config at all and `keep_vars` on, so the dashboard owns both values. Lesson:
  when two places can hold one setting, find out which one wins before choosing.
- **The stop button that did not stop the tape.** The Anthropic SDK's `MessageStream.abort()`
  only raises a flag; if the stream has gone quiet, the reply waits for the next event that may
  never come. Fix: race every read against the abort signal (`untilAborted`), proven by a test
  whose fake gateway never closes its stream. Lesson: read what "abort" actually does in the
  library before trusting the word.
- **The reload mid-take.** The first browser run of the runtime passed, but Vite reloaded the test
  page halfway: its dependency scan does not follow `new Worker(new URL(...))`, so it only found
  the worker's imports once the worker started. Fix: name those dependencies in
  `optimizeDeps.include`, then prove it from a cold cache and six runs in a row.
- **The stricter rulebook next door.** The catalog ships TypeScript sources, so they compile inside
  the runtime's stricter program, and eight of their index reads fail `noUncheckedIndexedAccess`.
  The runtime turns that flag off until the catalog passes it. Lesson: a shared base config only
  helps if every package actually passes it.
- **Two jobs painting the same wall.** Lefthook ran `oxlint --fix` and `oxfmt` in parallel on the
  same staged files, so a commit could land code oxlint changed after oxfmt had formatted it. It
  happened twice. Fix: the jobs run in order. Lesson: two tools that write the same files are a
  sequence, however fast each one is.

- **The 20px that was really 16.** The last card was meant to rest 20px above the compose box but
  measured 16 to 20px, because the thread scrolled to its end before the charts and fonts finished
  sizing, then stopped a few pixels short. Fix: while the thread is at its end, it stays there as
  content settles, and the padding subtracts the compose row's 4px inset so the visible gap is
  exactly 20px. Lesson: measure the resting state after everything has loaded, not the frame after
  mount.

- **The question that vanished.** Writing "Chat about a plan to capture a different selection of
  sales data" into the typed-answer row broke the card: at 64 characters it passed the row's
  60-character limit, so the strict schema dropped the whole question, as designed. It was also in
  the wrong row, which made rows 2 and 3 both ask "what do you want to chat about?". Fix: the way
  out got its own agent-worded field (`elsewhere`), and row 2 became a concrete question ("How many
  weeks ahead should it forecast?"). Lesson: fail-closed means a small content slip hides the whole
  card, so every row needs one clear job and a field of its own, and the rejection must go
  somewhere: back to the agent, which then asks in plain words (ADR-040).

- **The network block that wasn't.** A handoff note said yaklabs.ai was blocked, and it was repeated
  as fact until Ethan pointed out the environment had full network access. It did; the note was from
  an older environment. Reading the real stylesheet then showed three of our labels were wrong,
  including a "css" 0.72 text step that the site only uses for lines. Lesson: re-verify inherited
  facts before building on them, especially ones that stop you from checking the source.

- **Colour-grading the reference.** Several brand colours were picked from screenshots and a screen
  recording taken on a display with a blue-light filter, which warms everything like a tungsten gel
  over the lens. The CSS values were fine, but the hero greens, the cream and the button's hover
  fill were measured through the gel. Fix: drop every pixel-sampled brand colour and keep only what
  the stylesheet declares (ADR-051). Lesson: sample from the source file, never from the monitor; a
  colourist never trusts a reference frame shot through a filter.

- **The card with no last page.** Opening "Show my work" on the profit card made it taller than the
  view, and the reveal rule started tall cards at their top, so the steps ran on under the compose
  box and the card's bottom edge never appeared. A first fix only kept the button in view, which
  missed the point: without the bottom edge, a non-technical person can't tell the card has
  finished, so they hunt for a way to close it or wait for the agent to say more. Fix: an expanded
  card always scrolls until its bottom edge rests 20px above whatever covers it (ADR-071). Lesson:
  the end of the content is information too, like the end credits that tell an audience the film is
  over.

- **The credit that twitched.** The source line ("Demo store sales · Sep 14-20", the card's photo
  credit) seemed to shift between the open and closed card. Two causes: the interactive card's
  button lacked the fixed-width toggle class, so "Hide my work" was 6px narrower than "Show my
  work"; and the footer used fractional sizes (a 16.5px text line, a 30.89px button), so a browser
  could round the text and the button to different pixels at different scroll positions. Fix: one
  128px toggle width and a shared 17px line (ADR-072). Lesson: a pixel of drift between two states
  reads as unfinished; lock continuity like a script supervisor, and measure both states rather than
  eyeballing one.

- **Two versions of the same contract.** The DPA's sub-processor annex names Clerk for sign-in; the
  live Data Use page, which the DPA itself calls authoritative, names WorkOS, and the downloads site
  does redirect through WorkOS. Lesson: when two official documents disagree, find the one that says
  which governs, then check the live system.

- **The stash that forgot the new files.** To test a commit alone, the working changes were stashed
  and restored with `git checkout stash -- path`, which brings back tracked files only; the new,
  untracked files live in a separate part of the stash, and dropping it hid them. They were
  recovered from git's object store, intact. Lesson: to test a commit in isolation, check it out in
  a throwaway worktree instead of juggling stashes.

- **The autofix that broke its own lint.** The pre-commit hook ran `oxlint --fix` on the browser
  levers and rewrote their root resolution to `import.meta.dirname`, which left `fileURLToPath`
  imported and unused. The fixed file was staged, and the lint that had already passed never ran
  again, so CI caught it. Fix: the hook lints the fixed files a second time, without fixing.
  The same autofix also turned an index inside the lever into `.at()` on a NodeList, which has
  no such method, and nobody saw it until the lever ran again a day later; that rule is now off
  for the script folders. Lesson: an autofix is an edit like any other, and whatever checks the
  edit has to run after it.
- **The lever nobody imported.** fallow finds code by walking imports from the entry points it
  knows, so the two hand-run browser levers under `apps/web/scripts` counted as dead files the
  moment they were committed, and CI failed on them. Fix: declare them as entry points and keep
  them out of the complexity gate, as the DevTools snippets already were. Lesson: a tool that
  discovers your code from imports cannot see a script you start by hand; tell it.
- **The one shot that disagreed with seven.** After the thread panel's recap state moved into its
  own hook, the profit story's before-shot and after-shot differed by 2,253 pixels along the
  chart's x-axis. Three after-shots agreed with each other and with seven earlier sets from the
  whole session; the single before-shot had caught the chart mid-measure. Lesson: when one
  capture disagrees with the rest, suspect the capture before the code, and keep enough captures
  to tell the two apart.
- **The blank first take.** Ethan's first `pnpm dev:web` showed a white page. React Router 8
  hands Vite's dependency scan an empty list unless a future flag is on, so from a cold cache
  Vite met every dependency while serving the first page, re-bundled in two batches, and the
  reload it triggered asked for chunks the second batch had already replaced: 504s and nothing
  on screen until a second visit. The browser lever had hidden this for days behind a warm-up
  load. Fix: the flag, and a lever whose first load has to be clean. Lesson: when a check needs
  a warm-up to pass, the warm-up is the bug report.
- **Fifty-two pixels wide.** The first split rendered the thread as a sliver. The panel library
  reads a bare number as pixels and a string as a percentage, so `defaultSize={52}` asked for
  fifty-two pixels. The lever's frame showed it and a geometry dump named it. Lesson: when a layout
  is wrong by an order of magnitude, read the unit before the math.
- **The drag that was aimed at nothing.** The card drag timed out for the same reason: its handle
  sat inside that sliver, off screen, so the canvas intercepted the pointer. One bug, two symptoms;
  the fix for the first fixed the second. Lesson: chase the earliest failure, not the loudest.
- **Where paper meant cream.** Dark mode's first draft would have made the attention cards' text
  vanish: a dozen tokens said `var(--paper)` where they meant the cream, and once paper turned dark
  so did the text on the slate cards. Fix: the cream got its own name. Lesson: a token names a
  role; when one value plays two roles, split it before you theme it.
- **Eight props, one point over.** Adding one prop to the thread panel pushed fallow's cognitive
  score to 16 again, since it weighs props as well as branches. A ternary that chose between an
  empty style and one with a width went instead: React drops an undefined width by itself, so
  `style={{ width }}` renders the same DOM with one branch fewer. Lesson: before extracting, look
  for a branch that never needed to exist.
- **The exit code that belonged to head.** CI failed the catalog typecheck on `mark()` called with
  no argument, while the local check had printed `tsc=0`. The zero was real, just not tsc's: the
  command piped tsc into `head`, and `$?` reports the last command in a pipe. Fix: the parameter
  became optional, and the check now reads `PIPESTATUS`. Lesson: a green light means nothing until
  you know which lamp it is wired to.
- **The hand that reached out too soon.** The open hand appeared the moment a drag-select touched
  its first character. The pointer-move handler did check for a held button, but the browser also
  reports every change of the selection on `selectionchange`, and that handler refreshed the hand
  without asking whether a button was down. Fix: the thread remembers the pointer's buttons with
  its place, and no path shows the hand while one is down. The story now makes a selection under a
  held button and expects the I-beam. Lesson: when two events can reach one decision, the decision
  needs the same facts from both.
- **The screening room that never got the new pages.** The verify-storybook harness kept failing
  the grab story while the story suite passed, before and after the fix alike, and a stash-and-shoot
  "before" looked identical to "after". The tell was a timestamp in the stack trace that never
  changed: the private Storybook was serving the catalog from a build cache made in the previous
  session, so both sides of the comparison were the old code. Fix: `launch` now clears that cache
  before it starts. Lesson: a comparison is only as good as the certainty that the two sides
  differ in the way you think.
- **The pane with no overflow.** "The canvas is not horizontally scrollable." The lever said it
  was: the row overflowed and a wheel panned it. Both were right. On a wide screen a lane or two
  fit inside the pane, nothing overflowed, no scrollbar appeared, and the ground stopped at the
  edge, which is not what an infinite canvas feels like. Fix: the ground runs a full pane past the
  open space once a lane exists, the scrollbar stays in view, and the ground drags to pan. Lesson:
  a report that contradicts a measurement is usually about a case the measurement never set up.
- **The drop that missed the pane.** Proving that a dragged card dims meant driving the drag by
  hand instead of Playwright's one-call drag, and the drop stopped landing. The target's box was
  correct and off-screen: the one-call version had scrolled it into view on its own, and the
  hand-driven one did not. Lesson: when a convenience call is replaced by its parts, list what
  the convenience did for free.
- **The field torn down inside its own key event.** The story suite passed and printed one
  React warning: a component had suspended inside an `act` scope. It came from the Renamable
  story, only on Enter or Escape, never on a click elsewhere. The key handler was closing the
  rename field, so React unmounted the focused input in the middle of the key event that
  reached it; a blur closed it after the event was over. Fix: Enter and Escape blur the field,
  and the blur is the one way out. Lesson: a test that passes with a warning is a test with a
  finding, and the bisect is cheap when each run takes fifteen seconds.
- **The divider under the floor.** Ethan asked where the hint line's fade began, and proving the
  new profile meant hovering the real divider between thread and canvas, which the lever had
  never done: it had only measured the gaps between lanes. The divider's hint never lit. Giving
  the canvas its own stacking context, for the skeleton to sit under the lanes, had put the
  canvas above the divider's hit area, so the pointer landed on the canvas instead. Fix: the
  divider sits one layer up, and the lever now hovers it too. Lesson: a measurement that skips
  a surface is a promise about that surface nobody has checked.
- **Refs are not for rendering.** The lane drag measured its slots into a ref at pointer-down and
  the render read them back to place the skeleton. The React lint refused: a ref read during
  render can leave the screen behind the data. The measurement moved into state beside the move it
  serves, which is also more honest, since the render does depend on it. Lesson: if the picture
  needs it, it is state.
- **The title that stopped at the middle.** ADR-089 kept a lane's title to the left half of its
  bar so the six-dot grip in the middle never touched it. The grip only shows on hover, so at rest
  every longer title was cut short to make room for something that was not there. The fix started
  from a reproduction in headless Chromium, and the workspace lever's P1 failed on `main` before
  any CSS changed. Now the title hugs its text and runs the whole bar. On hover the grip fades up
  over a veil in the bar's own paper that fades out the stretch of title beneath it, and the veil
  is the grip's hit area, so a press there drags and never renames. P1 reads the darkest pixel
  beside the grip: 37 at rest, which is the title's ink, and 162 on hover, the veil (ADR-097).
  Lesson: do not hold space at rest for something only a hover brings, like a lower third that
  keeps a blank box for a logo that animates in on cue. The sidebar's project rows still make this
  trade, and `docs/LATER.md` has it.
- **The hand that turned back into an arrow.** Press a card's header and the hand closed; move,
  and an arrow came back until release. The header and a highlight both started an HTML5 drag, and
  during one the operating system draws the cursor and the browser ignores CSS. The lever measured
  it on `main`: one native `dragstart`, and `cursor: auto` under the pointer (P3h). The obvious
  repair was cancelling `dragstart`, and it was measured before anything was built on it. It
  failed. The pointer events kept coming, but a highlight collapsed on the first move, so there
  was nothing left to carry. `preventDefault` on `pointerdown` stops the native drag and keeps the
  highlight through the whole gesture. So the carry claims the press there, `html[data-carrying]`
  holds `cursor: grabbing` on every element, and a `dragstart` inside the thread is still refused
  as a backstop (ADR-091, ADR-102). Lesson: when the platform owns a behaviour, no CSS will win;
  find the earliest event you can own, and measure it before building on it.
- **A fifth of the tab left blank.** Switching a tab to the Thread layout should give the thread
  the whole tab. It got 932px and left 233px beside it empty, a fifth of the tab. The side pane was
  made collapsible in the same render that asked it to collapse, and `react-resizable-panels`
  applies a panel's new limits one render late, so the pane still had its old limits when asked
  to close, and refused. P9 now asks how much of its tab the thread fills: 80% on the old code,
  100% after. Fix: the side pane is collapsible all the time with fixed limits, and a drag that
  reaches the far edge closes it only until release, so the layout switch stays the one control
  that decides what sits beside the thread (ADR-106). Lesson: when a library applies a prop a render
  late, do
  not change the prop and lean on it in the same render. The lens was swapped as action was
  called, and the focus puller was still on the old marks.
- **Two loads, two pictures.** P7 loads each scenario twice and compares the screenshots byte for
  byte, and `demo` and `long` failed. The two loads drew the same paint commands, yet the pixels
  differed by one to four colour levels at a few anti-aliased edges: the window's corner, the
  inset's hairline, a tab's edge. Chromium's partial raster redraws only the part of a tile that
  changed, so an edge that straddled an earlier change kept a trace of the order the page loaded
  in. The app was the same both times, so the check was wrong. Fix: the levers launch Chromium
  with `--disable-partial-raster`, and the comparison stays byte-exact, with 24 of 24 loads
  identical (ADR-107). Lesson: when the scanner adds grain, fix the scanner. Loosening the
  comparison to hide the grain would have hidden real changes with it.
- **The card that took its lane with it.** Pressing a card's header inside a thread lane lifted
  the card and the whole lane together. The contract had the carry claim its press with
  `stopPropagation`, so the innermost handle won by silencing everything outside it. A review fix
  took that out so an open share menu, which listens on the document for a press outside it, would
  hear the press and close. The carry's own state still refused a second carry, but the lane's
  reorder in `apps/web` is not a carry and never asked. Fix: the carry's claim is `preventDefault`,
  and the lane takes only a press where `event.isDefaultPrevented()` is false. web-check proves it
  with a stand-in header that claims its press the same way, because the lab agent never answers
  with a card (ADR-108). Lesson: when you change how a signal travels, list everyone who listens
  for it, not only the listeners in your own package.
- **The thread that rested two pixels short.** Some thread stories came to rest a pixel or two
  above their end: 2 of 15 fresh loads of the dictation story, 7 of 15 of its narrow version.
  While a chart above sized itself, Chromium's scroll anchoring moved the thread's `scrollTop` to
  hold its place in the text, and the scroll event it fired arrived with the thread just short of
  its end. The thread read that as a reader scrolling away and unpinned itself. The story runner's
  viewport never hit the race, so no play function could catch it; loading each story fifteen
  times and measuring the gap did. Fix: only a reader's scroll unpins. A scroll that arrives with a
  change in how far the thread can scroll is the layout's, and keeps the pin. The rule is now a
  pure step, `pinnedAfterScroll`, with a table test that fails under the old rule, and none of 90
  loads across six stories rested short (ADR-103).
  That fix had a second act. A reader who scrolled up in the same frame a streaming reply grew was
  snapped back to the end, in all four thread stories a probe tried. A scroll event reads the
  layout when it is delivered, not when the scroll happened, so by the time it arrives the reply
  has grown and the reader's own scroll looks like the layout's. Two more rules over scroll events
  were measured and failed (23 and 12 of 360 loads rested short). So the thread stopped listening
  to scroll events. Scroll anchoring is off, and the thread decides when it resizes: it follows
  its end only if the gap before the growth was under 2px. The reader's scroll-up now holds in
  all four stories, and 0 of 360 loads rest short (ADR-109). Lesson: a scroll event does not say
  who scrolled, and it arrives late. Decide at the moment you know what changed, which here is the
  resize. It is "The 20px that was really 16", two levels deeper.
- **The tab that was never saved.** Open a thread from the sidebar, switch to another tab, and the
  new tab was gone, with its draft. The page drew the tab from the address, so it looked open,
  but the save step compared the change against a copy that already held the visit, saw no
  difference, and never wrote it. Every check that opened a tab happened to run another verb
  first, which saved the tab by accident, so the levers never saw it. An independent review with
  four lenses did, and three of the four reported it. Fix: a change is weighed against the
  document the worker holds, never against the one the screen shows. Lesson: when the screen and
  the store can disagree, test what the store kept, not what the screen drew. A continuity report
  that only reads the monitor misses the take that was never recorded.
- **The second tab that could delete the first.** The database library answers a failed start by
  deleting its whole folder, every saved thread in it. A second browser tab always failed to
  start, because the first held the files, and only those open files stopped the delete. If the
  first tab let go at the wrong moment, everything went. Fix, twice over: every tab queues on a
  browser lock before it touches the database, so a second tab waits and says "Your threads are
  open in another tab"; and the worker keeps a file of its own open inside the library's folder,
  so the delete is refused whatever happens (ADR-118). Lesson: read what a library does when it
  fails, not only when it works. The stunt looked safe until someone read the insurance terms.
- **Two agents, one stash.** Two fixers worked in separate folders of the same repository. One
  set a change aside with `git stash` to show a test failing first; the stash list is shared by
  every folder, so the other fixer's `stash pop` picked it up and landed it in the wrong place. The
  stray edit matched a commit that already existed, so nothing was lost, and the briefs now forbid
  `git stash`. Lesson: separate rooms are not separate if they share one shelf.
- **Green here, red in CI.** A fix read the thread's id through types React Router generates. My
  machine had them from an earlier typecheck; CI lints before it generates them, so there the id
  was an error type and lint failed twice. Fix: read the id with `useParams`, which needs no
  generated file, and lint the way CI does, with the generated folder moved aside. Lesson: a local
  run proves the local machine. Match the order of the real pipeline, like grading a shot on the
  monitor the client will watch.

- **The runtime that restarted for a parameter it never reads.** With `?chrome=painting` in the
  address, the tabs and the marker blinked out a moment after load. The runtime was keyed on the
  whole query string, and the first redirect keeps only `?scenario=`, so it saw a "new" address
  and started the worker again. It had always done this for any extra parameter, a tracking tag
  included; nothing had carried one until now. Fix: key it on the scenario alone, with a table
  test. The base then landed the same fix on its own (`useWanted()`), so the merge took theirs
  and dropped ours: two crews had found one bug, and the set only needs one repair. Lesson: key a
  memo on what it actually depends on, not on the envelope that happens to carry it.
- **The 44px rule that met a phone.** The polish promised the bar stays 44px tall at every
  width. Then the base gave phones a second row for the tabs, and the check failed at 80px with
  no polish change at all. The promise was really "the polish does not change the bar's height",
  so the check now records the base's height at each width in the baseline and compares against
  it, and still demands 44px from 768px up. Lesson: write a check against the intent, not
  against the number that happened to express it on the day.
  The last act: the phone bar had been fixed twice in parallel, as that second row and as the
  one 44px row of ADR-116. Ethan chose the one row, then saw what the question had meant: the
  44px was for the desktop. The phone got two rows after all, a fixed row and a row of views, so
  A2 now asks for 44px from 768px up and 82px below.
- **The avatar that decided how every letter was drawn.** Making the avatar's ring blend the same
  in both themes (`mix-blend-mode: normal`) changed 35,000 pixels in a panel it is nowhere near.
  Every glyph in the app had switched from greyscale to coloured subpixel smoothing. Chromium only
  uses subpixel text when it knows what lies under it, and one blend mode anywhere on the page
  made it play safe everywhere. The base's text is greyscale because of that ring. Fix: blend
  `darken` in both themes, which keeps the bar identical across themes and the text as it was.
  Lesson: a pixel-exact baseline catches what no eye would, and reading the diff (where, how much,
  what colour) finds the cause faster than guessing.
- **The trim that nudged a button it never touched.** A 2px frame drawn over the window's body
  left four pixels of the dark-mode send button one level off. Laid over the body in the page's
  own layer, the frame changed how Chromium composited what sat under it. `will-change: transform`
  gives the frame a layer of its own, and every pixel under it is the baseline's again (ADR-112).
- **The soft ink that the painting made unreadable.** The painting was clamped so cream stayed at
  5:1, and the lever still failed: the soft ink, cream at 72%, is dimmer than cream and fell to
  3.1:1 on the brightest strokes. The painted bar's soft ink is now cream at 85%. Lesson: a
  contrast floor belongs to the faintest ink on the surface, not the main one.
  That fix had a second act, found by the review. The script clamped the pixels, measured them,
  and only then encoded a lossy WebP, and the encode lifted some pixels past the clamp: the file
  itself reached luminance 0.134, where that soft ink is 3.9:1. The lever missed it because at
  1x the browser halves the 2880px image and averages the peaks away. Now the script decodes the
  file it wrote, measures that, and lowers its clamp until the file holds the bound (0.080 gets
  a decoded 0.096). It writes what it measured to `painting.json`, the token test reads it, and
  the lever measures the bar at 2x as well. Lesson: measure the artifact you ship, not the step
  before the last transform.
- **The lever that measured the badge as the bell's background.** The first contrast pass hid one
  node at a time and read what was left in its box. The bell's box also holds the unread badge,
  which is cream, so the cream bell read 1:1; the badge's round corners gave its "2" the bar as a
  background. The lever now takes one picture with every glyph and icon removed and measures each
  ink only over the pixels its own glyphs cover, less anything drawn on top of it.
- **The address changed behind the router's back.** `?chrome=` was taken out of the address with
  `history.replaceState` while the page rendered, but React Router kept its own copy of the old
  address. Clicking the thread already open then looked like a new address to it, so it pushed a
  second history entry, and Back went nowhere. A boot script now cleans the address before the
  router starts, the way the theme's boot script sets the theme before React. Lesson: a router
  owns the address; change it through the router, or before the router exists.
- **The probe that measured nothing and passed.** A new check for an avatar's initials read
  `Infinity`: it collected the inks inside the element, never the element's own text, found none,
  and the minimum of nothing is infinite, which clears every floor. The lever now counts an empty
  ink list as a failure, and the probe was shown to fail at 4.47:1 with the fix removed. Lesson: a
  check needs a way to say "I saw nothing", or nothing reads as a pass.
- **The focus ring the tab strip cut off.** The bar's new 2px ring sat 2px outside each control.
  On a tab that put it outside the tab strip, which scrolls, and a scroller clips whatever lies
  past its edge, so a focused tab showed almost no ring: the exact failure the rule was written
  for. The lever passed because it asked whether any pixel near the control was bright. A tab now
  draws its ring inside itself (cream, or night on the pill), and the lever asks how much of each
  side of the control the ring covers, so a ring clipped on one side fails.

- **The tab that would not fit its own floor.** On a phone the active tab's floor is the strip's
  width less the "+", written `min(100cqw - 32px, 10rem)`. A first try used `min(100%, 10rem)` and
  changed nothing: the tab list sizes itself from its tabs, so a percentage of it is a percentage
  of an answer that depends on the question. A container query unit measures the strip instead,
  whose width comes from the bar. Then the tab still landed 32px short of whole, because the
  scroller keeps 32px of `scroll-padding` for its edge fade, and a tab exactly as wide as the
  scroller has no room for it. Below 768px that padding is now zero. Lesson: when a size refuses
  to change, ask what it is measured against before changing the number.

- **The locator that grabbed the last thread's button.** Right after a sidebar click the address
  changes, but for a moment the old thread's panel is not yet inert, so a locator for "the shown
  panel's ⋯" resolved to the thread being left, and Pin pinned the wrong one. The lever now waits
  for the panel labelled with the new title, and its compose box, before touching anything.
  Lesson: "the visible one" is a race; wait for the one you mean by name.
- **The lint fix that broke the build.** The pre-commit hook's `oxlint --fix` rewrote an index to
  `.at(-1)`, whose type allows `undefined`, and the catalog's typecheck failed in CI. It passed
  locally because Turbo replayed a cached typecheck. Every gate now runs with `--force` before a
  push. Lesson: an automatic fix is a code change, and a cache can hide that it ever happened.
- **The share link that pointed into a thread.** A card's "Copy public link" built
  `share.html` relative to the page, so from `/t/t-005` it became `/t/share.html`, which the
  router read as a thread called "share.html": "This thread is gone". It now resolves against the
  site's root, and lever S3 opens a copied link to prove it.
- **The title that ate the lane's handle.** To push the menu to the title bar's end, the title was
  told to grow. In a canvas lane that made it cover the whole bar, so the middle of the bar, where
  you grab a lane, was the title, which renames: the grip never showed and the lane never lifted.
  Main's web-check caught it after the merge. The actions now push themselves along with an
  automatic margin, and the title keeps its own width. Lesson: when a layout change needs room,
  take it from the newcomer, not from the element other features stand on.
- **Focus on the wrong button.** A failed thread's frame kept focus "on its button", found as the
  first button in the frame. The frame's bar now carries the "⋯", which comes first, so a retry
  left focus on the menu. The rule now looks only in the frame's body.
- **The picture that waited forever.** To shoot menus once they stop fading, the script waited for
  every animation on the page to finish, and the radar in the browser pane sweeps forever. It now
  waits only for the menus' own animations.
- **A comma a screen reader heard wrong.** The menu's status ("Private", "Tue 9:00") was joined to
  the item's name by a hidden comma, but a flex row's parts join with a space, so the name read
  "Share thread , Private", and Snooze's time was left out entirely. Both items now state their
  name outright ("Snooze, Tue 9:00"), and lever A5 reads that name rather than the painted text.
- **The ADR numbers taken twice.** Main merged work that took ADR-123, then ADR-124 and 125, while
  this branch was open, so its decisions moved twice, ending at ADR-126 to 132. Lesson: number a
  long branch's ADRs last, just before the merge.
- **"The first button" found a new first button.** A thread that fails to open shows Try again,
  and pressing it keeps the focus there by querying the pending frame for `button`. The lane's new
  toggle also sits in that frame's title bar, earlier in the page, so the focus landed on the
  toggle. The web lever caught it ("Try again in Last week's sales; in Saturday leads..."). Try
  again now carries `data-retry` and the query asks for that. The thread menu's branch hit the
  same bug from the other side (its "⋯" is a button in that bar too) and scoped the query to the
  frame's body; the merge kept `data-retry`, which names the job and survives both. Lesson: a
  selector that names an element's kind instead of its job breaks the day a sibling of the same
  kind moves in.
- **The ghost that lost its grip.** A lifted strip's floating copy is appended to `<body>`, and
  the grip's dots were only drawn inside `[data-reorder="true"]`, the canvas. The copy rode the
  pointer without its grip. The grip is now drawn inside `.lane-ghost` too.
- **A width without a unit.** Moving the lane's width into a CSS custom property,
  `--lane-width`, sent 423 instead of 423px: React adds `px` to `width: 423`, never to a custom
  property. Lesson: custom properties are strings, so write the unit yourself.
- **The grid that grew a second column.** The main thread's welcome runs behind the compose box,
  so the scroll area was told to span every row of the panel's grid. The compose box, which
  asked only for row 3, found that row taken and was placed by the grid into a brand-new column
  to the right: the greeting squeezed into a third of the pane and the box floated off beside it.
  Every child now asks for column 1 by name. Lesson: the moment two things share a grid row,
  place both on both axes, or the grid places one for you.
- **A theme that only reaches half the component.** The 3-dot menu looked like a different app
  next to the share button. Kay's palette had reached it through variables, but the shadcn
  preset it was generated from (`base-lyra`) writes its shape into each file: `rounded-none`,
  `text-xs`, tight padding. Variables carry colour and one radius; they cannot carry shape.
  The vendored menu now has Kay's shape. There is no conversion script in the repo, so any
  component added with `shadcn add` arrives in lyra's shape again. Lesson: a design token system
  themes what it names; audit what the component hard-codes.
- **The example that would not start.** Copying `.env.example` to `.env` left
  `VITE_GATEWAY_URL=` empty, and the env parser reads an empty string as a bad URL, so the app
  failed at start. The example now comments those lines out.
- **Two icon sets for one action.** The card's share button was the catalog's hand-drawn box and
  arrow, while the thread's was lucide's `Share2`, three linked nodes: the same action wore two
  faces. The app is built on lucide and the catalog is deliberately dependency-free, so neither
  can absorb the other. The rule now is one glyph per action: where the catalog draws it (Share,
  copy link, open page) the app imports the catalog's, and lucide covers the rest. Lesson: when
  two icon sets meet, decide per action which one owns it, not per screen.
- **The check that read a title that was not there.** With the main thread's title row gone,
  three levers that read the name from `.thread-header` timed out, and one asserted the tab
  menu's items without the new Rename. They now read the panel's `aria-label` and the tab's
  menu. Lesson: when a layout change removes an element, search the checks for its selector
  before the run does it for you.

## 5. Director's Commentary

### The agent only states intent; the design system does the rest

The big insight for problem 2 ("a design system agents can build with") is that the agent should
never draw UI.
It should say *what* it means - "this is a comparison", "this action sends something outside Kay" -
and the system decides how that looks, moves, and asks for confirmation.

You already built a small version of this in `pm-interview-dashboard-main`.
In `src/App.tsx`, the model only names a tool; your code picks the component:

```tsx
// The LLM never writes UI. It names a tool and emits JSON args;
// this switch turns each result into a typed, designed component.
switch (result.tool) {
  case "listRecent":
    return <AgentRunsTable rows={toAgentRunRows(result.data)} />;
  case "listCostRollups":
    return <CostBreakdown rows={result.data} />;
  case "dailyUniqueUsers":
    return <DailyUsersLineChart data={toDailyUsersLineData(result.data)} />;
  default: {
    // Exhaustiveness check: adding a tool without a render decision
    // is a compile error, so no surface ever ships undesigned.
    const _exhaustive: never = result;
    return _exhaustive;
  }
}
```

```mermaid
flowchart LR
  A[Agent] -->|"intent + data<br/>'comparison', 'external action'"| C{Kay catalog}
  C --> T[Table<br/>TanStack logic + Kay skin]
  C --> H[Action<br/>tap to choose / hold to ship]
  C --> E[Edit<br/>redline + pins + versions]
  C --> R[Receipt<br/>outcomes first]
  P[Plugin with bespoke UI] -.->|escape hatch| S[Sandboxed iframe<br/>Kay tokens injected]
```

What the same move looks like at Kay's scale:

| Without a system | With one |
| --- | --- |
| The agent writes a custom "Send" button with a confirm popup | The agent uses `<Action effect="external">`, and it automatically gets tap-to-choose / hold-to-ship (ADR-010) |
| The agent overwrites a doc however it likes | The agent uses `<Edit>`, and it automatically gets a redline, respects pins, and records a version (ADR-011/012/013) |
| The agent writes a wall of text about what it did | The agent emits events, and the outcomes-first receipt renders itself (ADR-005/006) |

Why this matters:
the legibility patterns stop being one-off screens and become building blocks that every future
surface gets for free.
Problem 2 falls out of problem 1.

The film version: episodic TV has a different guest director almost every week, yet it feels like
one show because of the showrunner and the show bible.
The catalog is the show bible, written so well that a thousand guest directors - most of them agents
- still make one show without the showrunner reviewing every cut.

Senior-engineer takeaway: when output volume outgrows review capacity, stop reviewing outputs and
start constraining inputs.
Your `never` exhaustiveness check is the same idea in miniature: the compiler, not a reviewer,
guarantees coverage.

### A drag is data: measure once, compute the rest

Reordering lanes on the canvas could have been a tangle of event handlers moving DOM nodes about.
Instead the surface measures once, when the grip is pressed, and everything after is a calculation
over that measurement. `apps/web/src/canvas.ts` holds the arithmetic, and it has no idea what a
pointer is:

```ts
// Where each lane sat when the grip was pressed; the lift itself never moves the targets.
export type Slot = { left: number; width: number };

// A lane passes a neighbour once its centre crosses the neighbour's, and not before.
export function landingIndex(slots: Slot[], from: number, dx: number): number {
  const dragged = centre(slots[from]) + dx;
  let to = from;
  for (let i = from + 1; i < slots.length; i++) if (dragged > centre(slots[i])) to = i;
  for (let i = from - 1; i >= 0; i--) if (dragged < centre(slots[i])) to = i;
  return to;
}
```

```mermaid
flowchart LR
  D[pointerdown on the title bar] -->|measure every lane once| L["Lift<br/>slots, box, lane, x, y"]
  M[pointermove] -->|dx, dy| C{landingIndex}
  L --> C
  C -->|any move| G[a copy of the lane<br/>floats under the pointer]
  C -->|to = from| K[the lane waits dimmed<br/>where it was]
  C -->|to differs| S["the lane slides to slotLeft(to)<br/>neighbours shiftFor(i)"]
  U[pointerup] -->|to differs| R[onMove: moveLane, then arrange]
```

The film version: a dolly grip marks the track before the take. Once the marks are down, the
camera's position at any moment is a number along the track, not a fresh survey of the set.
The marks are the `Slot` list; `dx` is how far the dolly has rolled; `landingIndex` reads the
marks.

One choice in the flow is easy to miss: the row's DOM is never reordered while the lane is in
hand. The dimmed lane slides to its slot by a transform, and the real move happens on the drop.
Moving the pressed element in the DOM would release its pointer capture mid-drag, so the
choreography that looks like a live reorder is drawn, not done, until the hand opens.

Senior-engineer takeaway: the pure functions are the ones with unit tests (`canvas.test.ts` for
the landing arithmetic, the runtime's `workspace.test.ts` for the lane edits), the browser lever
proves the measuring and the drawing, and the two never have to be debugged at the same time.

### Test screenings, not beauty contests

The usual way to test a chart is to show two versions and ask "which do you prefer?"
People pick the prettier one, and UX research keeps finding that preference and performance often
disagree: the chart someone likes can be the one they misread.

`catalog-lab` flips this.
Every Storybook story is a scenario that carries the question a real user would ask, so the same
fixture serves development and research:

```ts
// packages/catalog/src/fixtures.ts
// Each scenario pairs a user question with a fixed agent payload,
// so a test session never depends on a live model's mood.
export const scenarios: Record<
  string,
  { label: string; question: string; payload: unknown }
> = {
  trend: {
    label: "Weekly trend",
    question: "How did closed cases change this week?",
    payload: trend,
  },
  // ...snapshot, comparison, sparse, missing, empty, unsupported, unsafe
};
```

```mermaid
flowchart LR
  S[Story<br/>fixed scenario] --> T[Task<br/>'find the highest value'<br/>'explain this gap']
  T --> A{Answer right?}
  T --> C{How sure?}
  A --> M[Calibrated trust<br/>sure when right,<br/>unsure when data is missing]
  C --> M
  M -->|misread with high confidence| X[Design failed,<br/>however pretty]
```

Two measurements matter: task success (did they get it right?) and confidence (how sure were they?).
Confidence is the one AI products forget.
The dangerous user is not the confused one; it is the confidently wrong one, who reads a missing
value as zero and acts on it.
Good legibility produces calibrated trust: sure when the data supports it, unsure when it does not.
That is the posting's "show too little and they cannot trust it" problem, measured.

The film version: at a test screening, the useful question is not "did you like the cut?" but "what
happened in act two?"
If the audience cannot retell the story, the edit failed, however beautiful it looks.

Say it in the interview in one line: "I don't ask users which chart they like; I give them a task
and measure whether they got it right and how confident they were, because with AI the danger is
confident misreading."

### Continuity: every interactive surface reports back

The moment a card becomes interactive, the agent and the user can end up looking at different
things.
The agent answered about gross profit; the user dragged the slider to net; the user asks "why did
Saturday drop?"; the agent confidently explains a chart the user is no longer looking at.
Nothing looks broken, which is what makes it the worst kind of legibility failure.

The film version is continuity: the script supervisor makes sure the next shot matches what the
audience last saw.
Dragging the slider changed the set, so the next take has to know.

The fix (ADR-030): the card's current state rides along with the user's next message as a visible,
removable chip, the same rule as the skill chip (ADR-009).
Silent context would also work technically, but then the user cannot see or control what the agent
acts on.

```ts
// Sketch: what the next message carries when the user has moved a control.
type OutgoingMessage = {
  text: string; // "Why did Saturday drop?"
  attachments: {
    kind: "card-state";
    turnId: string; // the card the state came from
    label: string; // shown on the chip: "Net profit · Sep 14–20"
    state: Record<string, string>; // { measure: "Net" }
  }[];
};
```

```mermaid
sequenceDiagram
  participant U as User
  participant C as Card (Kay runtime)
  participant K as Compose box
  participant A as Agent
  A->>C: chart + stepped slider (Gross)
  U->>C: drags to Net
  C->>C: chart and sentence update, no model call
  C->>K: chip "Net profit · Sep 14–20"
  U->>K: "Why did Saturday drop?"
  K->>A: text + card state {measure: Net}
  A->>U: answers about net profit
```

Say it in the interview: "When a surface is interactive, the agent has to know what the user
changed, and the user has to see that the agent knows."

### Reframe on the action: one rule for anything that expands

A camera operator does not wait for the director to shout "tilt up" every time an actor stands;
reframing on movement is the operator's standing job.
In the thread, the scroller is the camera operator, and it now reframes on its own: no component has
to ask.

```ts
// packages/catalog/src/threadReveal.ts: move only if the card is clipped, and only enough to rest
// it 20px above the compose box; a card taller than the view starts at its top; never scroll up.
export function nudgeScrollTop(target: Span, view: Viewport): number {
  const bandBottom = view.scrollTop + view.height - view.insetBottom;
  if (target.bottom <= bandBottom) return view.scrollTop;
  const bottomAligned = target.bottom - view.height + view.insetBottom;
  const topAligned = target.top - view.insetTop;
  return clamp(Math.max(view.scrollTop, Math.min(bottomAligned, topAligned)), view.maxScrollTop);
}
```

```mermaid
sequenceDiagram
  participant U as User
  participant C as Any card
  participant T as Thread (scroller)
  U->>T: pointerdown inside a turn (remembered)
  U->>C: clicks "View data table"
  C->>C: grows
  T->>T: ResizeObserver: this turn grew within 1s of a click in it
  T->>T: nudgeScrollTop(card, padding as the insets)
  T-->>U: card bottom rests 20px above the compose box
```

Two details make it hold up.
The insets come from the scroller's own padding, which already includes the dock card, so a nudged
card lands exactly where the thread's last card rests: one resting line, not two.
And growth nobody asked for (a chart sizing, a font loading) never nudges; it only keeps a thread
that was at its end at its end.

Say it in the interview: "Expansion is a camera move, so the thread owns it, and it moves the camera
as little as possible: only when something would be hidden, only as far as the resting line."

### Separation of concerns: the recap reports, "Needs you" asks

A "previously on" montage recaps the story; it never stops to ask the audience a question.
When the recap carried a "Needs you" line, a blocked agent waited ten idle minutes to be noticed,
and the user had to read history to find a decision.
Now the question is its own validated payload, and the host always adds the exit.

```ts
// packages/catalog/src/awaiting.ts: the agent supplies the question and its branches; the host
// renders them numbered and always appends "Chat about something else" (AwaitingInputCard.tsx).
export const awaitingSchema = z.strictObject({
  question: text,
  options: z.array(z.strictObject({ label: ..., detail: text.optional() })).min(1).max(4),
  answer: z.strictObject({ placeholder: ... }), // one concrete question, typed in the card
  elsewhere: z.string()...optional(), // the way out, worded for the moment
});
```

```mermaid
flowchart TD
  A[Agent] -->|blocked on the user| Q{awaitingSchema}
  Q -->|valid| N["Needs you card<br/>1 branch · 2 concrete question · 3 the way out"]
  Q -->|malformed| E[error goes back to the agent, never to the user]
  E --> S[agent streams a plain ask in the thread]
  A -->|work recorded| R[Recap: outcomes only, after 10 idle minutes]
  N -->|while open| H[recap waits]
```

Say it in the interview: "A recap is for catching up; a question is for deciding. Mixing them made
the decision wait and made the history noisy."

### One seam for a real model: the UI reports, the agent answers

A film set does not care whether the voice on the other end of the walkie-talkie is the real
director or a stand-in reading the script; it only needs the channel to work the same way.
The thread panel now talks to the agent through one channel, `Agent`, and the lab's scripted
stand-in is just one voice on it.

```ts
// packages/catalog/src/agent.ts: the only contract the thread knows.
export type AgentEvent =
  | { kind: "message"; text: string; attachments: CardAttachment[] }
  | { kind: "answer"; text: string }
  | { kind: "question-rejected"; reason: string; question: unknown };

export type Agent = {
  respond(event: AgentEvent, signal: AbortSignal): AsyncIterable<string>;
};
```

```mermaid
flowchart LR
  subgraph UI[catalog-lab UI]
    P[ChatThreadPanel] -->|AgentEvent| A{{Agent}}
    A -->|text chunks| P
  end
  A -.today.-> L[labAgent.ts<br/>scripted stand-in]
  A -.demo.-> R[real model runtime<br/>validates with awaiting.ts]
```

Two details make it hold up.
A reply is an `AsyncIterable` of text chunks, which is exactly the shape a model's token stream
already has, so a real agent is an adapter, not a rewrite.
And the `AbortSignal` lets the panel stop a reply the moment it unmounts, so nothing streams into a
thread nobody is looking at.

To run the UI against a real model later: write an `Agent` whose `respond` calls a small server
route (keeping the API key off the browser), stream its text back, and pass it as `<ChatThreadPanel
agent={realAgent} />`.

Say it in the interview: "The components never know who is answering; that is how the same UI is
tested with a script and shipped with a model."

### Three rings of proof: read it, run it, watch it

A linter reads code. A test runs it. A screenshot shows what a person would see. Each ring catches
what the one inside it cannot, and each runs where it is cheapest.

The middle ring is new: every story is now also a test. One Vitest config holds both kinds:

```ts
// packages/catalog/vite.config.ts and apps/storybook/vite.config.ts: two projects, one command (`pnpm test`)
projects: [
  // Plain functions and schemas, in Node: fast, no browser.
  { extends: true, test: { name: "unit", include: ["src/**/*.test.{ts,tsx}"] } },
  // Every story mounts in headless Chromium, runs its play function, then axe checks it.
  // A story that throws, or has a nested control or a low-contrast label, fails here.
  {
    extends: true,
    plugins: [storybookTest()],
    test: { name: "storybook", browser: { enabled: true, provider: playwright() } },
  },
],
```

```mermaid
flowchart LR
  E[Edit a component] --> H{pre-commit}
  H -->|staged files| F[oxfmt + wrap-md]
  H --> L[oxlint: defects, a11y, types]
  H --> T[tsc]
  H --> S[69 unit + 40 story tests<br/>render, play, axe]
  H --> A[fallow audit<br/>only what this commit adds]
  A --> P[Push / PR]
  P --> C{CI: same checks<br/>+ Storybook build<br/>+ audit vs PR base}
  E -.->|agent proving a change| V[verify-storybook<br/>affected stories → screenshots + ARIA trees]
```

The film version: the linter is the script supervisor reading pages, the story tests are the table
read where every scene is actually performed, and the screenshots are dailies. A script can look
fine on paper and still fall apart when read aloud; the modal's focus trap did exactly that.

Senior-engineer takeaway: put each check where it is cheapest to run and hardest to skip. The hook
catches it in seconds on your machine; CI catches whoever skipped the hook; the verify skill covers
what no automated check can judge, which is whether it looks right.

### Roll sound before action: attach the reader before you wait

The gateway must choose its HTTP status before it sends a byte, but it only learns whether Claude
accepted the request once the request is in flight. The natural order is "wait for the answer,
then start reading", and it passes every test on a laptop. It is still wrong: the SDK's stream
hands each event only to readers already listening, so an event that lands in between is lost,
like a line spoken before the boom mic was switched on.

```ts
// apps/gateway/src/app.ts: the order is the whole point.
const reply = anthropic.messages.stream({ model, max_tokens, thinking, system, messages });
// Roll sound: the reader starts listening now, before any event can arrive.
const body = reply.toReadableStream(); // → one JSON event per line
// Then call action: a 4xx/5xx from Claude throws here, before we answer the browser,
// so the route can still reply 502 { error: "upstream", status }.
await reply.withResponse();
return body;
```

```mermaid
sequenceDiagram
  participant B as Browser
  participant G as Gateway Worker
  participant A as Claude API
  B->>G: POST /api/messages, Bearer token
  G->>G: verify token (WorkOS keys), check body (zod)
  G->>A: messages.stream(...)
  Note over G: toReadableStream(): reader attached
  alt Claude accepts
    A-->>G: 200, then events
    G-->>B: 200 application/x-ndjson
    A-->>G: more events
    G-->>B: one event per line
    B->>B: MessageStream.fromReadableStream(body)
  else Claude refuses (529 overloaded)
    A-->>G: 529
    G-->>B: 502 { error: "upstream", status: 529 }
  end
```

To prove the point, the two lines were swapped on purpose and the whole suite still passed: in
node, the gateway happened to resume before the SDK parsed its first event. The order is right
because the SDK's source says its iterator starts with an empty queue, not because a test says so,
and the comment in the code says that, so nobody tidies it back later.

Senior-engineer takeaway: when a test passes, ask whether the code is right or the timing was
kind. A race that a fast machine hides is still a race; settle it by reading the source, then write
down why, where the next editor will look.

### The daemon backstage: one door, checked on both sides

Kay's desktop app never runs the agent in its window; a daemon does, and the window only talks to
it. The slice keeps that blocking with a Web Worker, so moving to Kay means recasting the worker
as their daemon, not rewriting the UI (ADR-076). One reply, in the worker, reads like a call sheet:

```ts
// packages/runtime/src/agentLoop.ts: one reply, in the order that loses nothing.
await update(loop, store, conversationId, (c) => withUserTurn(c, event, now())); // saved first
const agent = createAgent(spec, { store, conversationId, accessToken }); // lab or gateway
let text = "";
for await (const piece of agent.respond(event, signal)) {
  if (signal.aborted) break; // the user pressed stop
  text += piece;
  post({ kind: "chunk", requestId, text: piece }); // the page checks it on arrival
}
if (text.trim() !== "") {
  await update(loop, store, conversationId, (c) => withAgentReply(c, text, now())); // then this
}
post({ kind: "done", requestId });
```

```mermaid
sequenceDiagram
  participant P as Page (thread)
  participant W as Worker (daemon)
  participant S as SQLite in OPFS
  participant G as Gateway
  P->>W: send (event with the card-view chip)
  W->>S: save the user's turn
  W->>G: POST /api/messages, [Card view: Net profit · Sep 14–20] in the last turn
  G-->>W: model's text, streamed
  W-->>P: chunk, chunk, ... done
  W->>S: save the agent's reply
```

The film version: the stage manager writes the actor's line in the prompt book before the cue,
not after the scene, because a scene can be cut halfway and the book must still say what was said.

Senior-engineer takeaway: order your writes by what you cannot afford to lose. The user's words
are irreplaceable and go to disk first; the reply can always be asked for again.

### Move it, then prove it moved nothing

A layout move touches every file and changes no behaviour, which is exactly the kind of change
nobody re-tests. So the proof came first: every story was photographed twice from the old layout,
which also showed which six differ between two runs of the same code (live waveforms, a chart
mid-animation). After the move, and again after every token rename, the same forty screenshots
were compared byte for byte, and the only differences were those known animations.

```sh
# The same lever, before and after; cmp says identical or nothing.
node .agents/skills/verify-storybook/scripts/shoot.mjs $IDS --out before
git mv catalog-lab packages/catalog   # ... the whole move ...
node .agents/skills/verify-storybook/scripts/shoot.mjs $IDS --out after
for f in before/*.png; do cmp -s "$f" "after/$(basename "$f")" || echo "differs: $f"; done
```

```mermaid
flowchart LR
  A[Old layout] -->|shoot twice| B[Baseline + its own noise]
  A -->|git mv, rewrite configs| C[New layout]
  C -->|shoot once| D[After]
  B --> E{cmp byte for byte}
  D --> E
  E -->|identical| F[Proven unchanged]
  E -->|differs, on the noise list| G[Animation, not a change]
  E -->|differs, not on the list| H[Look, then fix]
```

Senior-engineer takeaway: capture the baseline before you touch anything, and capture its noise
too, so "different" has a meaning when the comparison runs.

### The carry: a script on paper, a thin crew on set

A carry can end in half a dozen ways: a release over a target that accepts, a release anywhere
else, Escape, the window losing focus, a `pointercancel`, a lost pointer capture. Written as event
handlers, each ending would need its own cleanup and its own browser test. Instead the rules are
one pure function, `stepCarry`, which takes the state and what just happened and returns the next
state plus a list of effects. The DOM shell around it only reports what happened and performs
what it is told.

```ts
// packages/catalog/src/carry.ts: the rules, with no DOM. A move past LIFT_PX turns an armed
// press into a carry and names what the page must do, in order; nothing is done here.
function stepArmed(state: Armed, input: CarryInput): [CarryState, CarryEffect[]] {
  switch (input.kind) {
    case "move": {
      if (travelled(state.from, input.at) < LIFT_PX) return [state, []]; // still a click
      const { pointerId, carried } = state;
      const lifted: Carrying = { phase: "carrying", pointerId, carried, hover: null };
      const [next, hover] = hoverOver(lifted, input.target, input.at); // → leave / over effects
      return [next, [{ kind: "lift" }, { kind: "follow", at: input.at }, ...hover]];
    }
    // ...a release or a cancel before the lift ends it as a click
  }
}

// The thin shell: step, perform, and take the picture down last, even when a target's `drop`
// throws.
function dispatch(press: Press, input: CarryInput): void {
  const [next, effects] = stepCarry(carry, input); // → [CarryState, CarryEffect[]]
  carry = next;
  try {
    for (const effect of effects) if (effect.kind !== "end") perform(press, effect);
  } finally {
    for (const effect of effects) if (effect.kind === "end") perform(press, effect);
  }
}
```

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> armed: press on a handle
  armed --> idle: release or cancel within 6px, a click
  armed --> carrying: move past 6px, then lift and follow
  carrying --> carrying: move, then follow, leave and over
  carrying --> idle: release over a target that said yes, then drop and end
  carrying --> idle: release elsewhere, Escape, blur or pointercancel, then leave and end
```

The film version: the rules are the shooting script, and `carry.test.ts` is the table read, where
every phase meets every input on paper before any set is built. The DOM shell is the crew, who
perform what the script calls for. The `finally` is the wrap call. Whatever went wrong in the
take, the set gets struck. The review found the take that needed it. A target whose `drop` threw
used to leave the picture on screen and the hand closed for good; now the error still reaches the
page, and the ghost, the hand and the listeners go regardless.

Senior-engineer takeaway: put the decisions where a test needs no browser, keep the part that
touches the browser too thin to hold a decision, and make the cleanup unconditional.

### One writer, one call sheet

The page never writes the workspace. It asks the worker, and for a write the worker answers
twice, first with the whole workspace as it now stands, then with a note that names the request.
The order is the point. By the time `create` resolves with a new thread's id, that thread is
already in the page's snapshot, so the page never looks up an id it cannot find.

```ts
// packages/runtime/src/agentLoop.ts: every write ends the same way, snapshot first.
async function write(
  loop: Loop,
  apply: (session: Session) => Extract<Notice, { kind: "created" | "done" }>,
): Promise<void> {
  const session = await started(loop);
  const answer = apply(session); // → { kind: "created" | "done", requestId, ... }
  pushState(loop, session); // the whole workspace, unless the page already has it
  loop.host.post(answer); // after the snapshot, so any id it names is already there
}

function pushState(loop: Loop, { store, source }: Session): void {
  const notice: Notice = {
    kind: "state",
    source,
    workspace: store.workspace(), // → Workspace: projects, threads, lanes, shell, no messages
    replying: replying(loop),
  };
  const serialized = JSON.stringify(notice); // → string, compared with the last push
  if (serialized === loop.lastState) return;
  loop.lastState = serialized;
  loop.host.post(notice);
}
```

```mermaid
sequenceDiagram
  participant P as Page (runtime.ts)
  participant W as Worker (agentLoop.ts)
  participant S as SQLite in OPFS
  P->>P: the new name shows at once, an overlay kept under r7
  P->>W: rename, requestId r7
  W->>S: store.rename(target, name)
  W-->>P: state with the whole workspace, skipped if nothing changed
  W-->>P: done, requestId r7
  P->>P: overlay r7 goes, the snapshot is the truth
  Note over P,W: if refused, failed with requestId r7, and only r7's overlay goes
```

The film version: the production office prints one call sheet after every change, and the set
reads only the latest. Every note sent to the office carries a ticket number, and the reply
quotes it. The old office answered runners in the order they queued, so when one note came back
refused, every runner still waiting was told no.

Senior-engineer takeaway: let one place write, push whole state, and match answers by id. Then an
optimistic edit is only an overlay on the last truth, and rollback is free, because the next truth
replaces it.

### A check that has never failed has proven nothing

Every predicate in `apps/web/scripts/workspace-check.mjs` was run on `main` before the work it
checks began, and recorded failing with a number: the title clipped at half the bar, a 1px rule
under the rename field, one native drag with `cursor: auto`, a card appended at the end of the
row, a 0px inset. A check that passes on the old code cannot see the bug, however green it looks.

```js
// apps/web/scripts/shell-checks.mjs, P9: once the layout is Thread, how much of its tab does
// the thread fill? Run first on the code before ADR-106, it read 80.
await layoutButton(page, "Thread").click();
await page.waitForTimeout(300);
const alone = await page.locator('[role="tabpanel"]:not([inert])').evaluate((tab) => {
  const thread = tab.querySelector('[data-slot="resizable-panel"]');
  const share = thread.getBoundingClientRect().width / tab.getBoundingClientRect().width;
  return Math.round(share * 100); // → 80 before the fix, 100 after
});
```

```mermaid
flowchart LR
  B[Bug report or brief] --> W[Write the predicate<br/>P1 to P12]
  W --> O{Run on the old code}
  O -->|FAIL, with a number| R[Baseline in results.json]
  O -->|PASS| X[The check cannot see the bug:<br/>fix the check first]
  R --> F[Build the fix]
  F --> N{Run again}
  N -->|PASS| D[Done: old value, new value]
  N -->|FAIL| L{The app or the camera?}
  L -->|the app| F
  L -->|the camera, as partial raster was| C[Fix the lever, keep it strict]
```

The film version: before a shoot, the camera team puts a test chart in front of the old lens and
the new one. If the chart looks the same through both, the test cannot show the difference you
are paying for. The lever is the chart. P7 taught the other half. A failing lever still needs
reading, because its two loads differed at a few corners from how Chromium rastered them, not
from any change in the app (ADR-107).

Senior-engineer takeaway: write the check, watch it fail on the old code with a number, then
build, and report old value against new value. When it fails after the fix, ask whether the app
or the camera is wrong before touching either.

### A surface is a lighting setup, not a paint job

The green bar holds a dozen shadcn primitives: tabs, ghost buttons, a toggle group, a badge, an
avatar, a skeleton. None of them got a colour of its own. The bar redefines what the colour
*words* mean inside it, and every primitive, which only ever says "ink" or "hover fill", comes out
right.

```css
/* packages/catalog/src/tokens.css: one rule re-lights everything inside the bar. */
.chrome-surface {
  --ink: var(--on-chrome); /* cream, 8.98:1 on the green */
  --soft-ink: var(--on-chrome-soft); /* cream at 72%, 5.56:1 */
  --paper-deep: var(--chrome-hover); /* the hover fill */
  --focus: var(--on-chrome); /* the ring, cream */
  /* shadcn's roles resolve on :root, so the ones the bar's primitives read are restated */
  --accent: var(--paper-deep);
  --ring: var(--focus);
  background: var(--chrome);
}
/* A piece of cream on the bar puts the night inks back, as a spotlight inside a gel. */
.chrome-surface .chrome-pill {
  --ink: var(--on-chrome-pill);
}
```

```mermaid
flowchart TD
  T[tokens.css :root<br/>--ink, --paper-deep, --focus] --> P[Page: sidebar, threads, menus]
  T --> C[.chrome-surface<br/>re-maps the same names]
  C --> B[Tabs, buttons, badge, toggle<br/>say only 'ink', 'hover', 'ring']
  B --> G[Cream on green, no colours of their own]
  C --> Pill[.chrome-pill<br/>night inks on cream]
  M[Menus in portals] -.outside the gel.-> P
```

The film version: you do not repaint the actors' costumes for a night scene; you change the gel on
the lights. The bar is a gel. One catch is worth remembering: a custom property that refers to
another (`--accent: var(--paper-deep)`) is worked out where it is declared, so shadcn's roles,
declared on `:root`, would keep the page's values inside the bar. The surface has to restate each
role its primitives read. `.attention-surface` taught that pattern first.

Senior-engineer takeaway: when a region needs a different look, re-map the meaning of the tokens
for that region instead of restyling the components in it. Then a new component dropped into the
bar is right on day one, and the contrast lives in one place, where a unit test can check every
ratio from the token values.

### Settle a layout fight with a ruler, not a meeting

The phone bar had four candidate fixes and a fixed budget: 390 pixels. Rather than argue which
control deserved the space, each candidate was a few lines of CSS injected into the real app, and
one script measured what the active tab's title got.

```js
// apps/web/scripts/shell-checks.mjs, P13: how much of the active title does the list show?
const list = bar.querySelector('[role="tablist"]').getBoundingClientRect();
const title = bar.querySelector('[role="tab"][aria-selected="true"] .truncate');
const shown = title.getBoundingClientRect();
return Math.round(Math.min(shown.right, list.right) - Math.max(shown.x, list.x));
// → 17px with the Layout group inline, 37px with an icon marker, 82px behind a trigger
```

```mermaid
flowchart LR
  Q[Which control gives way?] --> P1[Prototype: all inline, tighter]
  Q --> P2[Prototype: icon marker]
  Q --> P3[Prototype: Layout behind a button]
  P1 --> M[One probe, same page, same widths]
  P2 --> M
  P3 --> M
  M -->|17px| X1[Rejected]
  M -->|37px| X2[Rejected]
  M -->|82px| K[Won the budget]
  K --> E[Ethan: the phone wants two rows]
```

The film version: when two camera positions compete, you do not debate them in the production
office; you shoot both on the stand-in and look at the monitor. The probe is the stand-in, and
the winning shot's numbers become the continuity sheet (P13) that every later take is checked
against.

Senior-engineer takeaway: if a design question has an answer you can measure, measure it. The
numbers end the argument, and the script that produced them becomes the regression test.

The twist is the other half of the lesson. The ruler answered "what fits in 44px?" perfectly,
and the answer was set aside, because the 44px rule was meant for the desktop and nobody had
asked what a phone should be. A measurement settles the question you put to it; it cannot tell
you that you asked the wrong one. When the question is "what should this be?", put a working
build in the person's hand, as the picture of Amp's two rows did here, before you optimise.

### Plan as data, act at the edge

Four features needed "something happens later": a snooze wakes, an idle thread archives, a
deleted one is purged, a share expires. Rather than four timers with four sets of bugs, one pure
function reads the rows and the time and returns a plan; a thin actor applies it and sets one
timer for the plan's `next`.

```ts
// packages/runtime/src/settle.ts (abridged): a calculation, no clock and no database
export function planSettle({ rows, shares, now, starting }: SettleInput): SettlePlan {
  const wake = rows.filter((row) => row.snoozedUntil !== null && row.snoozedUntil <= now); // due
  const archive = deadlines.filter((each) => each.at <= now).map((each) => each.id); // idle 14d
  const purge = tombs.filter((each) => starting || each.at <= now).map((each) => each.id);
  const expire = shares.filter((share) => share.expiresAt <= now).map((share) => share.id);
  const next = ahead.toSorted().at(0) ?? null; // → the earliest moment anything falls due
  return { wake, archive, purge, expire, next };
}
```

```mermaid
flowchart LR
  T[Worker starts / any write / timer fires] --> R[readSettleInput: rows, shares, now]
  R --> P[planSettle: pure]
  P --> A[settleThreads: one transaction]
  A --> N[Notices: Back from snooze]
  P -->|next, at most a day| T
```

The film version: the script supervisor does not shout "wake up" at an actor whenever they
remember; they keep a call sheet of who is due when, check it at every break, and set one alarm
for the next entry. The call sheet is data you can read and test; the alarm is the only moving
part.

Senior-engineer takeaway: Grokking Simplicity's split in practice. The rules (calculations) got
exhaustive unit tests with made-up times; the actions (writing SQLite, posting a notice) are
thin enough to trust, and a hand-cranked timer in the agent-loop tests proves they are wired.

### The key never goes to the vault

"Public for 1 day" is only a promise if something enforces it. The data rides to the gateway
already sealed; the key rides in the part of the URL a browser never sends.

```ts
// apps/web/src/shell/share-thread.ts (abridged): seal on the page, send only ciphertext
const { sealed, key } = await sealThread({ v: 1, title, messages, expiresAt }); // → bytes, key
const response = await client.fetch(`${client.base}/api/shares?ttl=${seconds}`, {
  method: "POST",
  body: sealed, // the server stores this with expirationTtl = seconds
});
const link = threadLink(created.id, key, { href: client.base }); // → /share.html#t=<id>.<key>
```

```mermaid
sequenceDiagram
  participant P as Page (owner)
  participant G as Gateway + KV
  participant R as Reader
  P->>P: seal thread with a fresh AES-GCM key
  P->>G: POST ciphertext, ttl
  G-->>P: id, revoke token (G keeps only its hash)
  P->>R: link /share.html#t=id.key
  R->>G: GET /api/shares/id (the fragment stays home)
  G-->>R: ciphertext, until its TTL
  R->>R: open with the key from the fragment
  P->>G: DELETE with revoke token (Stop sharing)
```

The film version: you hand the vault a locked canister stamped "destroy on the 29th", and mail
the key to your friend inside the invitation. The vault can prove it destroyed the canister, and
it never had the key to peek.

Senior-engineer takeaway: when privacy is the product, put the guarantee where a mistake cannot
reach it. A server that never holds the key cannot leak the thread, and a store that deletes on
a TTL cannot forget to.

### Name the job, not the kind: selectors are casting calls

A query is a casting call. `[data-pending] button` asks for "any actor in a costume"; it worked
while one actor wore one. The day the lane's collapse toggle joined the scene in the same costume,
the call went to the wrong person, and the focus followed.

```ts
// apps/web/src/components/thread-pane.tsx: where the focus rests while a thread opens or fails.
const REST: Record<Turns["kind"], string> = {
  loading: "[data-pending]",
  failed: "[data-pending] [data-retry]", // Try again, not the collapse or the menu in the bar
  open: ".compose-box textarea",
};
```

```mermaid
flowchart LR
  P[Try again pressed] --> F{thread fails again}
  F --> Q1["query: [data-pending] button"]
  F --> Q2["query: [data-pending] [data-retry]"]
  Q1 --> T[first match: the collapse toggle in the title bar]
  Q2 --> R[Try again]
  T --> X[focus leaves the place you were]
  R --> OK[focus stays where you pressed]
```

The same idea runs through the lane: the reorder grip is `[data-collapsed="true"]`, the strip's
parts are `[data-lane-strip-title]` and `[data-lane-strip-grip]`, and the focus hand-off asks for
`[data-lane-close], [data-lane-toggle]`. Each names what the element is for, so adding a second
button anywhere nearby cannot recast the scene.

Senior-engineer takeaway: when code finds an element to act on, find it by its role in the story
(a data attribute or an accessible name), never by its tag or its position. And keep a check that
drives the real flow, like the web lever did here, because a wrong match compiles and renders
fine.

### The matte goes in first: a mask is layer order, not a paint job

Three splash looks, one stacking rule. In Figma a mask is the bottom layer of its group and cuts
everything above it; in CSS a mask is a property of the layer it cuts. Either way the picture is
never edited: a plate says how much of it shows, and the plate is authored on its own.

```css
/* apps/web/src/index.css: Atlas is a stencil (black on alpha) used as a mask and filled with a
   token, so he themes; a second mask, a gradient, fades his feet out before the edge. */
html[data-splash="vitruvian"] .splash-drawing {
  background: var(--splash-figure); /* the ink at 30%: the paint */
  mask-image: url("/splash/atlas.webp"), linear-gradient(black 55%, transparent); /* two plates */
  mask-composite: intersect; /* a pixel shows only where both plates let it */
}
```

```mermaid
flowchart BT
  P[Paper: the open space] --> L[Lit fill: the carry's tint]
  L --> M["Picture under its plate<br/>a radial gradient, or the stencil ∩ a fade"]
  M --> D[Dots, redrawn on the field's grid]
  D --> W[Words and button]
  W --> S["Splash · look (debug switch)"]
```

The film version: a garbage matte never touches the negative. The colourist grades the plate, the
compositor decides where it shows, and the two jobs stay in two rooms. Ethan's Figma group went
wrong because the matte was loaded second; the fix was not a better gradient, it was putting the
plate in first.

Senior-engineer takeaway: when a look depends on order, make the order the design. The three looks
share one DOM and one stack; the attribute on `<html>` picks the plate, and nothing else moves.


### One clock, two actors: a wave is a delay, not a second animation

The "agent working" glyph (Storybook: Motion/Agent working) is Kay's 2x2 task-size squares,
animated so a band of green sweeps left to right. There is only one keyframe track. Every square
plays it; the right column is simply started 35% of a cycle later, so it peaks just as the left
column begins to fade. Colour rides on opacity inside that one track: solid is moss, half-faded
is olive, nearly clear is sage.

```css
/* packages/catalog/src/motion.css */
.agent-working {
  --working-duration: 1200ms; /* one knob; Storybook scrubs it */
  /* a head start of 65% is the same as a lag of 35%, and never shows a blank first frame */
  --working-lag: calc(var(--working-duration) * -0.65);
}
.agent-working-cell:nth-child(even) {
  --working-offset: var(--working-lag); /* right column: same track, shifted */
}
```

```mermaid
sequenceDiagram
  participant L as Left column
  participant R as Right column
  Note over L,R: one 1200ms cycle, same keyframes
  L->>L: 0-35% fade in, sage → moss
  R->>R: already fading out from last cycle
  L->>L: 35-50% hold solid
  R->>R: 0-35% fade in (35% behind)
  L->>L: 50-100% fade out, moss → olive → sage
  R->>R: holds solid while left fades
```

The film version: two dancers, one piece of music, the second one counting in late. You do not
choreograph a second routine, you cue the same one later. A canon in music works the same way.

The first cut ran at 150ms: nearly seven loops a second, which the eye reads as flicker, not a
travelling wave, and the fade through the greens lasted about 75ms, too short to register. It now
ships at 1200ms. The Speeds story plays 650, 850, 1200, 1350 and 1500ms side by side, because
timing is a taste call that is easier to defend with the alternatives on screen than in words.

Senior-engineer takeaway: when motion must stay in sync, derive every actor from one clock. A
second keyframe track would drift the moment someone changed one duration and not the other.
