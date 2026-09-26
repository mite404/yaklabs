import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Agent } from "./agent";
import { ChatThreadPanel } from "./ChatThreadPanel";
import { threads } from "./thread";

// A fixed clock keeps idle-time stories deterministic.
const NOW = Date.UTC(2026, 8, 25, 9, 16);
const MINUTE = 60_000;

const meta = {
  title: "Thread/Chat thread panel",
  component: ChatThreadPanel,
  parameters: { layout: "centered" },
} satisfies Meta<typeof ChatThreadPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 80 characters of text plus 20px gutters: the standard thread column. */
export const Standard: Story = { args: { thread: threads.trend } };

/** A narrow thread beside an open split pane: cards switch to compact density. */
export const NextToSplitPane: Story = {
  args: { thread: threads.trend, width: 420 },
};

/** Fallbacks and catalog limits must stay honest at thread size too. */
export const Fallbacks: Story = { args: { thread: threads.fallbacks } };

export const FallbacksNarrow: Story = {
  args: { thread: threads.fallbacks, width: 420 },
};

/** Active thread, 12 minutes since the user's last message: the recap appears. */
export const RecapAfterIdle: Story = {
  args: {
    thread: threads.trend,
    now: NOW,
    activity: { active: true, lastUserInputAt: NOW - 12 * MINUTE },
  },
};

/** The agent is blocked on a question (ADR-039): numbered choices above the compose box.
 *  Pick the branch, type an answer in the card, or chat about something else. */
export const AwaitingInput: Story = { args: { thread: threads.awaiting } };

export const AwaitingInputNarrow: Story = {
  args: { thread: threads.awaiting, width: 420 },
};

/** A malformed question never becomes a card (ADR-040): the error goes back to the agent,
 *  which streams a plain ask instead. Here the way out was written into the one-line
 *  typed-answer row, where it would not fit. */
export const AwaitingInputMalformed: Story = { args: { thread: threads.malformed } };

/** Only 4 minutes idle: no recap yet. */
export const RecentlyActive: Story = {
  args: {
    thread: threads.trend,
    now: NOW,
    activity: { active: true, lastUserInputAt: NOW - 4 * MINUTE },
  },
};

/** Idle but finished: an inactive thread has nothing new to recap. */
export const InactiveThread: Story = {
  args: {
    thread: threads.trend,
    now: NOW,
    activity: { active: false, lastUserInputAt: NOW - 40 * MINUTE },
  },
};

/** Dictation takes over the thread: a large center-playhead waveform, typing paused. */
export const Dictation: Story = {
  args: { thread: threads.trend, startDictating: true },
};

/** An open microphone picker takes Escape first; the next Escape cancels dictation itself. */
export const DictationPickerEscapes: Story = {
  args: { thread: threads.trend, startDictating: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /System Default/ }));
    // The dialog rises in from opacity 0, and on that first frame nothing inside it counts as
    // visible; wait it out rather than assert once.
    await waitFor(async () => {
      await expect(canvas.getByRole("listbox", { name: "Choose microphone" })).toBeVisible();
    });
    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("listbox", { name: "Choose microphone" })).toBeNull();
    await waitFor(async () => {
      await expect(canvas.getByRole("dialog")).toBeVisible();
    });
    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("dialog")).toBeNull();
  },
};

export const DictationNarrow: Story = {
  args: { thread: threads.trend, startDictating: true, width: 420 },
};

/** Uses your real microphone; the browser asks for permission first. */
export const DictationLiveMicrophone: Story = {
  args: { thread: threads.trend, startDictating: true, dictationSource: "microphone" },
};

/** Interactive card (ADR-029): a stepped slider walks gross to net profit; the chart and
 *  the agent's sentence update instantly, and the choice rides along with the next message. */
export const InteractiveProfit: Story = { args: { thread: threads.profit } };

export const InteractiveProfitNarrow: Story = {
  args: { thread: threads.profit, width: 420 },
};

// An agent whose reply breaks off before a word arrives: a refused gateway, a dropped line.
const brokenAgent: Agent = {
  respond(): AsyncIterable<string> {
    throw new Error("The gateway replied 401");
  },
};

/** A reply that fails ends the turn in plain words instead of a bubble that streams forever. */
export const ReplyFails: Story = {
  args: { thread: threads.trend, agent: brokenAgent },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "Message" }), "And next week?{Enter}");
    await expect(
      await canvas.findByText("I couldn't finish that reply. Try again in a moment."),
    ).toBeVisible();
    await waitFor(async () => {
      await expect(canvas.queryByRole("article", { busy: true })).toBeNull();
    });
  },
};

// A pointer event at a point, the way the browser would send it.
function pointer(type: string, x: number, y: number, buttons = 0): PointerEvent {
  return new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, buttons });
}

/**
 * A highlight is something to pick up: an open hand over it, a closed one while it is held, and
 * the I-beam for as long as the highlight is still being made.
 */
export const HighlightGrab: Story = {
  args: { thread: threads.trend },
  play: async ({ canvasElement }) => {
    const scroller = canvasElement.querySelector<HTMLElement>(".thread-scroll");
    const paragraph = canvasElement.querySelector<HTMLElement>(".turn-agent p");
    if (!scroller || !paragraph) throw new Error("the thread did not render");
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    const box = range.getBoundingClientRect();
    const [x, y] = [box.left + 12, box.top + box.height / 2];

    // The thread starts watching the pointer in an effect, so the first move is repeated
    // until it is heard; a plain throw keeps the retries out of the console.
    await waitFor(() => {
      paragraph.dispatchEvent(pointer("pointermove", x, y));
      if (scroller.dataset.grab !== "ready") throw new Error("the thread is not listening yet");
    });
    await expect(scroller).toHaveAttribute("data-grab", "ready");
    await expect(getComputedStyle(scroller).cursor).toBe("grab");

    paragraph.dispatchEvent(pointer("pointerdown", x, y, 1));
    await expect(scroller).toHaveAttribute("data-grab", "held");
    await expect(getComputedStyle(scroller).cursor).toBe("grabbing");

    document.dispatchEvent(pointer("pointerup", x, y));
    await expect(scroller).toHaveAttribute("data-grab", "ready");

    paragraph.dispatchEvent(pointer("pointermove", box.left - 40, y));
    await expect(scroller).not.toHaveAttribute("data-grab");
    await expect(getComputedStyle(scroller).cursor).not.toBe("grab");

    // The browser grows a selection under a held button and reports it on selectionchange;
    // the same events by hand, with the button down throughout.
    document.getSelection()?.removeAllRanges();
    paragraph.dispatchEvent(pointer("pointerdown", x, y, 1));
    document.getSelection()?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    paragraph.dispatchEvent(pointer("pointermove", x + 24, y, 1));
    await expect(scroller).not.toHaveAttribute("data-grab");
    await expect(getComputedStyle(scroller).cursor).not.toBe("grab");
    document.dispatchEvent(pointer("pointerup", x + 24, y));
    await expect(scroller).toHaveAttribute("data-grab", "ready");
  },
};
