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

// The thread's scrolling turns and its reading tools, found from the story's canvas.
function parts(canvasElement: HTMLElement) {
  const scroller = canvasElement.querySelector<HTMLElement>(".thread-scroll");
  const tools = canvasElement.querySelector<HTMLElement>(".reading-tools");
  if (!scroller || !tools) throw new Error("the thread or its reading tools did not render");
  return { scroller, tools: within(tools) };
}

// The bookmark, once the pointer on Search has unfolded the bar to show it.
async function unfold(tools: ReturnType<typeof parts>["tools"]) {
  await userEvent.hover(tools.getByRole("button", { name: "Search this thread" }));
  return tools.findByRole("button", { name: "Your requests" });
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
 * The reading tools float at the right just above the compose box. At rest they are one Search
 * button; the pointer on it unfolds the bar leftward to show the bookmark too.
 */
export const Overview: Story = {};

/**
 * The bar rests as Search alone and unfolds while the pointer is on it, then folds again. Search
 * never moves: the bookmark opens to its left.
 */
export const FoldsToSearch: Story = {
  play: async ({ canvasElement }) => {
    const { tools } = parts(canvasElement);
    const search = tools.getByRole("button", { name: "Search this thread" });
    await expect(tools.queryByRole("button", { name: "Your requests" })).toBeNull();
    const before = search.getBoundingClientRect().left;

    await unfold(tools);
    await expect(search.getBoundingClientRect().left).toBe(before);

    await userEvent.unhover(search);
    await userEvent.hover(canvasElement.ownerDocument.body);
    await waitFor(async () => {
      await expect(tools.queryByRole("button", { name: "Your requests" })).toBeNull();
    });
  },
};

/**
 * The bookmark lists every request the user sent by its first 15 characters and its time; the
 * full request shows on hover. Picking one centers that turn and makes it glow, and the bar folds
 * back to Search once the pointer moves on.
 */
export const JumpToARequest: Story = {
  play: async ({ canvasElement }) => {
    const { scroller, tools } = parts(canvasElement);
    await userEvent.click(await unfold(tools));
    const list = within(document.body).getByRole("menu", { name: "Your requests" });
    const items = within(list).getAllByRole("menuitem");
    await expect(items).toHaveLength(ASKED.length);
    await expect(items[1]).toHaveTextContent("Which day had t…9:04");
    await userEvent.click(items[3]);
    await expectLandedOn(scroller, "ask-3");

    // The list closed under the pointer, so no leave reached the bar; moving on still folds it.
    await userEvent.hover(scroller);
    await waitFor(async () => {
      await expect(tools.queryByRole("button", { name: "Your requests" })).toBeNull();
    });
  },
};

/** An Alt-click (Option on a Mac) on the bookmark skips the list: straight to the latest. */
export const AltClickForTheLatest: Story = {
  play: async ({ canvasElement }) => {
    const { scroller, tools } = parts(canvasElement);
    scroller.scrollTop = 0;
    // One session, so the held Alt is still down when the click lands.
    const user = userEvent.setup();
    await user.keyboard("{Alt>}");
    await user.click(await unfold(tools));
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
    const { scroller, tools } = parts(canvasElement);
    await userEvent.click(tools.getByRole("button", { name: "Search this thread" }));
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
    const { tools } = parts(canvasElement);
    await userEvent.click(tools.getByRole("button", { name: "Search this thread" }));
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
  decorators: [
    (Story) => (
      <div style={{ height: "100vh" }}>
        <Story />
      </div>
    ),
  ],
};
