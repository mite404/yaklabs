# Chat thread

The thread panel is where a user talks to the agent: user messages as tinted bubbles, agent
replies with catalog cards, a compose box with attach and dictate, a recap after the user has been
away, and a card that asks the user a question when the agent is waiting on them.

## Sub-features

- `thread-messages` shows user and agent messages as labelled articles in order.
- `thread-compose` sends a typed message; Send is disabled while the box is empty.
- `thread-attach` opens the attach menu with files and screenshot.
- `thread-recap` shows a "previously on" recap after idle time.
- `thread-awaiting` shows an awaiting-input card with choices and a free-text answer.
- `thread-interactive` renders an interactive card (the profit slider) inside the thread.
- `thread-fallbacks` shows the refusal notice in context.
- `thread-narrow` lays all of this out in a narrow panel.

## How to get to it (user POV)

- The panel is the product surface; there is no app route yet. In Storybook: `Thread/Chat thread
  panel`, stories `thread-chat-thread-panel--{standard,next-to-split-pane,fallbacks,
  fallbacks-narrow,recap-after-idle,awaiting-input,awaiting-input-narrow,awaiting-input-malformed,
  recently-active,inactive-thread,interactive-profit,interactive-profit-narrow}`.

## Driving it with Storybook

Preconditions:

- Doctor is OK on port 6106.

- **Messages.** Load `thread-chat-thread-panel--standard`. The tree has
  `region "Service desk weekly review"` containing `article "You, 9:02"`, `article "Agent, 9:02"`,
  `article "You, 9:04"` and `article "Agent, 9:04"`, each agent article holding a card.
- **Compose.** `textbox "Message"` has placeholder `What would you like to do?` and
  `button "Send"` is `[disabled]`. Type a message; Send enables. Press Enter to send.
- **Attach.** Click `button "Attach"`. It becomes `[expanded]` and `menu "Attach"` lists
  `menuitem "Add images & files ⌘U"` and `menuitem "Take screenshot"`. Escape closes it.
- **Recap.** Load `thread-chat-thread-panel--recap-after-idle` and compare with
  `--recently-active` (no recap) and `--inactive-thread`.
- **Awaiting input.** Load `thread-chat-thread-panel--awaiting-input`. The card offers numbered
  choices and a free-text answer labelled `How many weeks ahead should it forecast?`.
  `--awaiting-input-malformed` must show a safe notice, not a broken card.
- **Interactive card.** Load `thread-chat-thread-panel--interactive-profit`.
  `region "Last week's sales"` holds `heading "Last week's profit by day"` and
  `slider "Gross profit"` at its first stop, with the text `Gross profit was $57.2k`. Focus the
  slider and press ArrowRight: its value text becomes `Operating profit` and the text reads
  `Operating profit was $34.1k`. ArrowLeft returns to gross.
- **Proof.** `shoot.mjs` on every id above, and the `-narrow` ids with `--width 420`.

## Gotchas

- The panel defaults to `labAgent`, a scripted stand-in for the model. Its replies are fixtures,
  so asserting on reply wording is asserting on a fixture.
- `Add images & files ⌘U` hard-codes the Mac shortcut label although the handler also accepts
  Ctrl+U.
- `Take screenshot` calls `getDisplayMedia`, which headless Chromium cannot grant. Opening the
  menu is provable; capturing is verified-unreachable here.
- The awaiting-input free-text option was a `role="radio"` wrapping an `input` (axe
  `nested-interactive`). If you touch `AwaitingInputCard`, re-run `npm run test:stories` and
  re-read this recipe's handles against the new markup.
- `--dock-space` is set from JavaScript, so the compose box position depends on a rendered dock.
  Screenshot after the story settles, not on first paint.
