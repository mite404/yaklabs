import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ChatThreadPanel } from "./ChatThreadPanel";
import type { Thread, ThreadMessage } from "./thread";

// A morning of questions, long enough that the first ones scroll out of sight.
const ASKED = [
  ["9:02", "How did profit do last week?", "Profit rose 12% on the week, led by Saturday."],
  ["9:04", "Which day had the best margin?", "Saturday: 41% margin on the highest sales."],
  ["9:07", "Show me refunds by day", "Refunds peaked on Monday at 3.1% of sales."],
  ["9:11", "Why was Monday so high?", "A late shipment was refunded in one batch on Monday."],
  ["9:15", "Compare with the week before", "Sales were up 8%, and the margin held at 38%."],
  ["9:20", "What should I restock first?", "Restock the olive oil: it sold out by Saturday noon."],
  ["9:26", "Draft a note to the team 📝", "Here is a short note on the week's margin and refunds."],
] as const;

const morning: Thread = {
  title: "Monday numbers",
  messages: ASKED.flatMap(([time, asked, answered], i): ThreadMessage[] => [
    { id: `ask-${i}`, role: "user", text: asked, time },
    { id: `answer-${i}`, role: "agent", text: answered, time },
  ]),
};

// The thread's scrolling turns and its reading tools, found from the story's canvas, once the
// thread has the focus: the tools show only in the focused thread, so the story clicks into the
// compose box first, as a reader would.
async function parts(canvasElement: HTMLElement) {
  const scroller = canvasElement.querySelector<HTMLElement>(".thread-scroll");
  const bar = canvasElement.querySelector<HTMLElement>(".reading-tools");
  const box = canvasElement.querySelector<HTMLElement>(".compose-box textarea");
  if (!scroller || !bar || !box) throw new Error("the thread or its reading tools did not render");
  await userEvent.click(box);
  return { scroller, bar, tools: within(bar) };
}

// Search, once the pointer on the bookmark has unfolded the bar to show it.
async function unfold(tools: Awaited<ReturnType<typeof parts>>["tools"]) {
  await userEvent.hover(tools.getByRole("button", { name: "Your requests" }));
  return tools.findByRole("button", { name: "Search this thread" });
}

// A computed colour's alpha: 1 for an opaque one. Chromium serialises a color-mix as
// `color(srgb r g b / a)` and a plain colour as `rgb(...)` or `rgba(...)`.
function alphaOf(color: string): number {
  const slash = /\/\s*([\d.]+)\s*\)$/u.exec(color);
  if (slash) return Number(slash[1]);
  const rgba = /^rgba\((?:[^,]+,){3}\s*([\d.]+)\)$/u.exec(color);
  return rgba ? Number(rgba[1]) : 1;
}

// Whether the turn with this id glows and sits in the middle of the visible thread, or, when
// the thread cannot scroll up that far (a turn near its start), in full view at the top. A turn
// near the end still centers: the jump adds room below the end (threadReveal.ts).
async function expectLandedOn(scroller: HTMLElement, turnId: string) {
  const turn = scroller.querySelector<HTMLElement>(`[data-turn-id="${turnId}"]`);
  if (!turn) throw new Error(`no turn ${turnId}`);
  await expect(turn.dataset.flash).toBe("true");
  await waitFor(async () => {
    const view = scroller.getBoundingClientRect();
    const box = turn.getBoundingClientRect();
    if (scroller.scrollTop < 1) {
      await expect(box.top).toBeGreaterThanOrEqual(view.top);
      await expect(box.bottom).toBeLessThanOrEqual(view.bottom);
    } else {
      // The scroller's padding band shifts the centre a little; a jump lands well within this.
      const offCentre = box.top + box.height / 2 - (view.top + view.height / 2);
      await expect(Math.abs(offCentre)).toBeLessThan(40);
    }
  });
}

const meta = {
  title: "Thread/Reading tools",
  component: ChatThreadPanel,
  parameters: { layout: "centered" },
  args: { thread: morning, width: 560 },
  argTypes: {
    thread: { table: { disable: true } },
  },
} satisfies Meta<typeof ChatThreadPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The reading tools float at the right just above the compose box, in the thread that has the
 * focus. At rest they are one bookmark on a translucent wash; the pointer on it unfolds the bar
 * leftward to show Search too.
 */
export const Overview: Story = {
  play: async ({ canvasElement }) => {
    await parts(canvasElement);
  },
};

/**
 * The bar rests as the bookmark alone and unfolds while the pointer is on it, then folds again.
 * The bookmark never moves: Search opens to its left.
 */
export const FoldsToTheBookmark: Story = {
  play: async ({ canvasElement }) => {
    const { tools } = await parts(canvasElement);
    const bookmark = tools.getByRole("button", { name: "Your requests" });
    await expect(tools.queryByRole("button", { name: "Search this thread" })).toBeNull();
    const before = bookmark.getBoundingClientRect().left;

    await unfold(tools);
    await expect(bookmark.getBoundingClientRect().left).toBe(before);

    await userEvent.unhover(bookmark);
    await userEvent.hover(canvasElement.ownerDocument.body);
    await waitFor(async () => {
      await expect(tools.queryByRole("button", { name: "Search this thread" })).toBeNull();
    });
  },
};

/**
 * Translucent until it is opened: the bar's wash lets the turn under it read through, only its
 * glyph opaque; the list of requests is the same wash. Opening either tool fills the bar solid.
 */
export const OpensSolid: Story = {
  play: async ({ canvasElement }) => {
    const { bar, tools } = await parts(canvasElement);
    await expect(alphaOf(getComputedStyle(bar).backgroundColor)).toBeLessThan(1);
    await userEvent.click(tools.getByRole("button", { name: "Your requests" }));
    const list = within(document.body).getByRole("menu", { name: "Your requests" });
    await expect(alphaOf(getComputedStyle(list).backgroundColor)).toBeLessThan(1);
    await waitFor(async () => {
      await expect(alphaOf(getComputedStyle(bar).backgroundColor)).toBe(1);
    });
    await userEvent.keyboard("{Escape}");
    await waitFor(async () => {
      await expect(alphaOf(getComputedStyle(bar).backgroundColor)).toBeLessThan(1);
    });
  },
};

/**
 * One thread's tools at a time: across two threads, only the one the reader has clicked into
 * shows its bar; the other's is hidden until it is the one in focus.
 */
export const OnlyTheFocusedThread: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 24 }}>
      <ChatThreadPanel {...args} width={420} />
      <ChatThreadPanel
        {...args}
        thread={{ ...args.thread, title: "Tuesday numbers" }}
        width={420}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const panels = [...canvasElement.querySelectorAll<HTMLElement>(".thread-panel")];
    const boxes = panels.map((panel) => panel.querySelector<HTMLTextAreaElement>("textarea"));
    const bars = panels.map((panel) => panel.querySelector<HTMLElement>(".reading-tools"));
    const [firstBox, secondBox] = boxes;
    const [firstBar, secondBar] = bars;
    if (!firstBox || !secondBox || !firstBar || !secondBar)
      throw new Error("two threads did not render");
    await userEvent.click(secondBox);
    await waitFor(async () => {
      await expect(getComputedStyle(firstBar).visibility).toBe("hidden");
      await expect(getComputedStyle(secondBar).visibility).toBe("visible");
    });
    await userEvent.click(firstBox);
    await waitFor(async () => {
      await expect(getComputedStyle(firstBar).visibility).toBe("visible");
      await expect(getComputedStyle(secondBar).visibility).toBe("hidden");
    });
  },
};

/**
 * The bookmark lists every request the user sent by its first 15 characters and its time; the
 * full request shows on hover. Picking one centers that turn and makes it glow, and the bar folds
 * back to the bookmark once the pointer moves on.
 */
export const JumpToARequest: Story = {
  play: async ({ canvasElement }) => {
    const { scroller, tools } = await parts(canvasElement);
    await unfold(tools);
    await userEvent.click(tools.getByRole("button", { name: "Your requests" }));
    const list = within(document.body).getByRole("menu", { name: "Your requests" });
    const items = within(list).getAllByRole("menuitem");
    await expect(items).toHaveLength(ASKED.length);
    await expect(items[1]).toHaveTextContent("Which day had t…9:04");
    await userEvent.click(items[3]);
    await expectLandedOn(scroller, "ask-3");

    // The list closed under the pointer, so no leave reached the bar; moving on still folds it.
    await userEvent.hover(scroller);
    await waitFor(async () => {
      await expect(tools.queryByRole("button", { name: "Search this thread" })).toBeNull();
    });
  },
};

/** An Alt-click (Option on a Mac) on the bookmark skips the list: straight to the latest. */
export const AltClickForTheLatest: Story = {
  play: async ({ canvasElement }) => {
    const { scroller, tools } = await parts(canvasElement);
    scroller.scrollTop = 0;
    // One session, so the held Alt is still down when the click lands.
    const user = userEvent.setup();
    await user.keyboard("{Alt>}");
    await user.click(tools.getByRole("button", { name: "Your requests" }));
    await user.keyboard("{/Alt}");
    await expect(within(document.body).queryByRole("menu")).toBeNull();
    await expectLandedOn(scroller, `ask-${ASKED.length - 1}`);
  },
};

/**
 * Search finds the words in any turn. Enter steps to the next match and Shift+Enter back, both
 * wrapping; Escape closes the search and hands the focus back to its button.
 */
export const SearchTheThread: Story = {
  play: async ({ canvasElement }) => {
    const { scroller, tools } = await parts(canvasElement);
    await userEvent.click(await unfold(tools));
    const field = tools.getByRole("searchbox", { name: "Search this thread" });
    await expect(field).toHaveFocus();

    await userEvent.type(field, "margin");
    await expect(tools.getByRole("status")).toHaveTextContent("4 matches");
    await userEvent.keyboard("{Enter}");
    await expect(tools.getByRole("status")).toHaveTextContent("1 of 4");
    await expectLandedOn(scroller, "ask-1");

    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    await expect(tools.getByRole("status")).toHaveTextContent("4 of 4");
    await expectLandedOn(scroller, "answer-6");

    await userEvent.keyboard("{Escape}");
    await expect(tools.queryByRole("searchbox")).toBeNull();
    await expect(tools.getByRole("button", { name: "Search this thread" })).toHaveFocus();
  },
};

/** No turn holds the words: the count says so and the steps stay off. */
export const NoMatches: Story = {
  play: async ({ canvasElement }) => {
    const { tools } = await parts(canvasElement);
    await userEvent.click(await unfold(tools));
    await userEvent.type(tools.getByRole("searchbox"), "invoices");
    await expect(tools.getByRole("status")).toHaveTextContent("No matches");
    await expect(tools.getByRole("button", { name: "Next match" })).toBeDisabled();
    await expect(tools.getByRole("button", { name: "Previous match" })).toBeDisabled();
  },
};

/**
 * A main thread stands on its pane with no title bar (ADR-138); the tools keep the same corner,
 * at the pane's edge rather than the text column's.
 */
export const OnAMainPane: Story = {
  args: { bare: true, width: undefined },
  parameters: { layout: "fullscreen" },
  play: async ({ canvasElement }) => {
    await parts(canvasElement);
  },
  decorators: [
    (Story) => (
      <div style={{ height: "100vh" }}>
        <Story />
      </div>
    ),
  ],
};
