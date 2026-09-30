# One shell: the plan

The head of product opens the app and lands on a splash listing two projects, Demo and Live
Playground. Either opens a thread at `/t/:id` in the one shell. Demo threads play the scripted
scenarios. The Live Playground thread is a real production thread, persisted and signed in,
answered by the model through the gateway, rendered through the same panel. `/new` goes.
`/playground` and `/demo/weekly-brief` redirect into the shell. A first visit shows the abstract
painting and no canvas.

This file is the designed workflow the figure-it-out playbook asks for. The decision trail is
`docs/decisions/one-shell.tsv`. The designs it synthesises are the six arena candidates under
the session scratchpad (`arena/door1`, `arena/door2`), summarised below.

## Definition of done

All of these hold on the real product in Chromium, driven by the lever, before the phase ends.

1. `/` on a fresh device lands on the splash listing exactly Demo and Live Playground. No
   Demo store or profit fixture anywhere.
2. Clicking a project row opens its entry thread at `/t/:id` in the same shell, thread layout,
   canvas hidden until the layout switch is pressed.
3. The three Demo threads play their scenarios under `/t/demo-*` and the 23-step lever passes
   against the baseline.
4. The Live Playground thread streams the model's events through the worker and
   `ChatThreadPanel`, with Work details, cards, a limitation with a one-click recovery, and the
   question dock. Its turns survive a reload. No file under `apps/web/src/playground` remains.
5. `/new` is deleted. `/playground` and `/demo/weekly-brief[?script=]` redirect into the shell.
6. A first visit shows the abstract painting.
7. Typecheck, lint, format, fallow and every package's tests pass on the head.

## Synthesis

### Door 1. Where the world lives

The pivot decided the shape before the candidates landed. The Live Playground thread is a
device thread in the worker's workspace, seeded as the device starter in place of Demo store
and profit. It needs no routing of its own, because the production agent for every device
thread becomes the model-with-tools agent. The scripted Demo is a page-side overlay: an
in-memory world composed with the worker runtime behind one `Runtime` the shell reads.

Base: candidate B (the World). Grafts and rejections:

- From B, kept. World, Show and Take as the domain. A Stage that exposes no turn writer, so
  every writer holds a Lease and Restart revokes the leases in the same commit that resets the
  slice. Restart scopes to one thread. A generic pane rule, a turn count that drops means
  reread, so a mounted panel notices a Restart without a shell seam. `openProject` as a shell
  verb the splash rows call. The redirect table with `clientLoader` routes. The scenario picker
  deleted, since the sidebar's Demo project is the picker.
- From C, grafted. The `Seat` sum type (scripted, live, lab) so a thread is one kind and a new
  kind fails the build at each match. The world as one declared value that the seed, the cast
  and the redirect table derive from. Ids minted in one module. `?splash=` carried through a
  redirect. Validation of the spec at module load.
- From A, grafted. The nullable `useDemo` lookup by `shell.active.main` for the banner, and the
  bias to keep names where a rename buys nothing.
- Rejected. A `VITE_WORLD` switch between two runtimes (all three), since the shell now always
  runs the worker and the overlay is a build feature, `VITE_DEMO`. Whole-world Restart by key
  bump (A), since it would tear down the worker. A seeded landing thread inside Demo (C), since
  the device starter is the landing thread. `firstRun` opening no tab (B), since the starter
  thread opens on the thread pane and its empty state is the splash.

The composition is explicit. `composeRuntime(worker, overlay)` returns a `Runtime` whose
`state()` merges the two workspaces by concatenation, whose verbs route by who owns the id, and
whose `agent(id)` asks the overlay first. The overlay owns every id it minted and nothing else.
The shell document is written through the worker alone. No record has two writers.

### Door 2. The live adapter

Base: candidate C (stateless, history derived from the turns). Grafts and rejections:

- From C, kept. The adapter keeps nothing between replies. The thread's stored turns are the
  only record, and the next request is a pure projection of them, ids derived from position,
  a question paired with its answer by position, a later message after an open question read
  by the gateway as a skip. In the worker the record is the store's transcript, the same source
  the words-only gateway agent reads today, with the pending user turn stripped the same way.
  One factory and one link type on the surface, the wire types behind it. Every failure reaches
  the reader as a terminal failure in plain words, never a status code.
- From B, grafted. Seam members that the scripted demo also uses, each with an `applyChunk`
  rule, a render rule and a test. A card `id` so a later card replaces the earlier one in
  place. A `limitation` block with a recovery the reader sends in one click. `WorkStep.basis`,
  evidence as lines under the outcome. `Failure.retry: false` so Try again hides when it cannot
  help. The per-status failure wording.
- From A, grafted. The contract test that runs the gateway's test-kit rounds through the real
  gateway, the adapter, `applyChunk` and back through the request schema. The `seq` idempotence
  rule. One copy table for every sentence the adapter writes. A streaming-safe Markdown emitter
  in the adapter that commits closed lines as blocks and, inside the open line, plain text up
  to the last space before an unclosed marker, so the seam stays typed.
- Rejected. A third `history` parameter on `Agent.respond` (B), since the worker agent reads
  the store. A `markdown` seam member that keeps parser source on the stored turn (B), since
  the emitter keeps the seam typed. A new `unfinished` step status (B), since `cancelled`
  already settles a running step when a reply ends. Evidence as `log` lines (A, C), since
  `basis` lines under the outcome are what the reader looks for. A second ledger in the adapter
  (A). A holding gate in any consumer (A, C), since the protocol change below removes the need.

### The protocol change

Text is always prose. Narration is never derived from text after the fact. The gateway stops
relabelling a round's lead text, deletes the `narration` event, and carries progress through
`work` labels alone, which is what its prompt already tells the model to do. The closing
failure's cause folds into `end{reason, line}`, so no consumer looks one event ahead.
`PLAYGROUND_PROTOCOL` becomes 2, so a page on one version against a gateway on another fails
at `start` and says so. The answer streams word by word. The honest cost is that a model which
writes prose before a tool call shows that line as prose, and the prompt already forbids it.

### Cross-judge verdict

The judge scored door 1 for B (15 against 13 and 11) and door 2 for C (18 against 16 and 14),
and carried the protocol change with the stronger form above. It agreed with this synthesis on
door 1 and moved it on door 2, where it had B as the base with C grafted. Its reasons held: an
agent created per message cannot keep a ledger, and a `markdown` member leaks parser state into
the stored turn. The judge shares this session's model family, so the agreement is weaker
evidence than a cross-vendor judge would give.

## Units, riskiest unknown first

Each unit ends in a check on the real artifact and is committed before the next starts.

### U1. The worker carries structured turns

- Protocol. The `chunk` notice carries a `ReplyChunk` (a string or a `ReplyEvent`), parsed by a
  zod schema for the seam's events. `threadMessageSchema` accepts an agent turn's `blocks`,
  `work`, `activity`, `ended`, `failure`, `asks`, and a user turn's `question`.
- Store. No migration. The message row already keeps the turn's extra fields as JSON beside
  the text.
- Loop. `reply()` folds every chunk with `applyChunk`, forwards the chunk, and saves the folded
  turn. `agentFor` yields the chunk it receives.
- Check. Runtime tests: a fake agent yielding a card, a step, a question and a failure round
  trips through the worker and comes back from `open()` whole. A page test that the panel
  renders a card from a worker reply.

### U2. Gateway protocol v2, text is always prose

- Text streams as prose from the first delta. The `narration` event and the relabelling
  machinery go. Progress reaches the page through `work` labels alone. The closing failure's
  cause folds into `end{reason, line}`.
- `PLAYGROUND_PROTOCOL` becomes 2. The test kit and its fixtures follow.
- Check. Gateway tests that lead text before a tool call stays prose, that a limit ends with
  its line, and that the version is 2 at `start`.

### U3. The seam widens

- Card `id`, `limitation`, `WorkStep.basis` and `Failure.retry` in `reply.ts`, `prose.ts` and
  `thread.ts`, with `applyChunk` rules and renders in `QuietProse`, `Turns` and `WorkDetails`.
- The panel gains `sendText` for a recovery. The brief scenario uses a limitation, basis lines
  and a card replaced by id, so the demo proves the members.
- Check. Fold tests for each member, stories with axe, the storybook suite.

### U4. The model-with-tools agent in the worker

- `packages/runtime/src/playgroundAgent.ts` with its transport, its request projection from
  the store's transcript, and the streaming Markdown emitter that turns prose deltas into typed
  `block`, `text` and `link` chunks. It replaces the words-only gateway agent for
  `VITE_AGENT=gateway`, and the old agent is deleted with its callers.
- Failures speak in the seam's words. No session, sign-in expired, bad request, upstream
  refused, cut off.
- Delete `apps/web/src/playground` in full. `/playground` redirects into the shell.
- Check. An in-process test that runs the gateway's test-kit rounds through the real gateway,
  the agent, the worker and `applyChunk`, then round trips the projection through the request
  schema. The emitter at every split point of each fixture equals the parse of the whole. In
  the browser, the signed-out failure path.

### U5. The Demo overlay and the splash

- `composeRuntime`, the World, Show, Take and Stage with leases, per-thread Restart, the pane's
  reread rule, `ShowBar` in the window's banner slot, the redirect table, `VITE_DEMO`.
- The device starter seeds Live Playground with one empty thread. `firstRun` opens it on the
  thread pane. Splash rows call `openProject`. The painting defaults to abstract.
- Delete `/new` and the demo routes. Repoint the lever to `/t/demo-*` with one step through a
  redirect.
- Check. The 23-step lever against the baseline, plus new steps for the splash rows, the
  redirect, the canvas staying hidden, and a Restart that leaves the live thread alone.

### U6. Docs and the trail

- A new ADR for the one shell. Amendments to ADR-137, ADR-146, ADR-147, ADR-148, ADR-155.
  Pillars for the limitation block and the basis lines. FOR_ETHAN. README routes. The PR body.
- The decision log audited against the transcript, and a cross-model review of the trail.

## Risks

- The live path cannot be driven end to end from this sandbox, since the gateway requires a
  WorkOS token. U4's in-process test covers the translation, and the browser covers the
  signed-out path. The model itself is seen on the deployed build.
- Two builds must deploy together at U2 and U4, the gateway and the page. A page on v2 against
  a gateway on v1 fails the `start` version check loudly, which is the intended failure.
- The limitation block and the basis lines need two or three new CSS values. They come from
  existing tokens and are flagged in the pillars for Ethan's call.
- `firstRun` changing to the thread pane changes the first visit for every device build. That
  is the wanted behaviour.
