import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Agent } from "./agent";
import { useCarryTarget } from "./carry";
import { ChatThreadPanel } from "./ChatThreadPanel";
import { scenarios } from "./fixtures";
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

/**
 * A thread on the canvas can be renamed in place (ADR-089): the title opens as a field on a
 * click, Enter keeps the new name, Escape keeps the old one.
 */
export const Renamable: Story = {
  args: { thread: threads.trend, width: 420, onRename: fn() },
  play: async ({ args, canvasElement }) => {
    const header = canvasElement.querySelector<HTMLElement>(".thread-header");
    if (!header) throw new Error("the thread did not render");
    await userEvent.click(within(header).getByRole("button", { name: args.thread.title }));
    const field = within(header).getByRole("textbox", { name: "Thread title" });
    await userEvent.clear(field);
    await userEvent.type(field, "Weekend margins{Enter}");
    await expect(args.onRename).toHaveBeenCalledWith("Weekend margins");
    await expect(within(header).getByRole("button", { name: args.thread.title })).toBeVisible();

    await userEvent.click(within(header).getByRole("button", { name: args.thread.title }));
    await userEvent.type(within(header).getByRole("textbox"), " scrapped{Escape}");
    await expect(args.onRename).toHaveBeenCalledTimes(1);
    await expect(within(header).getByRole("button", { name: args.thread.title })).toBeVisible();
  },
};

// A mouse event at a point, the way the browser would send it.
function pointer(type: string, x: number, y: number, buttons = 0): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  });
}

function middleOf(element: Element): { x: number; y: number } {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

// A stand-in for the compose canvas, pinned where the pointer can reach it at any viewport
// size: it takes whatever is carried to it and lists what it heard, once per change.
function CarryTarget() {
  const ref = useRef<HTMLElement>(null);
  const [heard, setHeard] = useState<string[]>([]);
  const [landed, setLanded] = useState<string>();
  const hear = (line: string) => {
    setHeard((lines) => (lines.at(-1) === line ? lines : [...lines, line]));
  };
  useCarryTarget(ref, {
    over: (carried) => {
      hear(`over ${carried.kind}`);
      return true;
    },
    leave: () => {
      hear("leave");
    },
    drop: (carried) => {
      hear(`drop ${carried.kind}`);
      setLanded(JSON.stringify(carried));
    },
  });
  return (
    <section
      ref={ref}
      aria-label="Carry target"
      data-landed={landed}
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        zIndex: 10,
        width: 200,
        padding: 8,
        border: "1px dashed var(--soft-ink)",
        background: "var(--paper)",
        color: "var(--ink)",
        fontSize: 12,
      }}
    >
      <p style={{ margin: 0 }}>Drop a card or a highlight here</p>
      <ol aria-label="Heard" style={{ margin: 0, paddingLeft: 18 }}>
        {heard.map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ol>
    </section>
  );
}

function heardBy(target: HTMLElement): string[] {
  return within(target)
    .queryAllByRole("listitem")
    .map((item) => item.textContent);
}

// The first card's header, the card itself, and the target, once the thread has rendered.
function carryScene(canvasElement: HTMLElement) {
  const handle = canvasElement.querySelector<HTMLElement>(".card-heading[data-carry]");
  const card = handle?.closest(".card");
  if (!handle || !(card instanceof HTMLElement)) throw new Error("no card to carry");
  const target = within(canvasElement).getByRole("region", { name: "Carry target" });
  const box = handle.getBoundingClientRect();
  return { handle, card, target, start: { x: box.left + 20, y: box.top + 20 } };
}

const withCarryTarget: Story["render"] = (args) => (
  <>
    <ChatThreadPanel {...args} />
    <CarryTarget />
  </>
);

/**
 * A card carried by its header rides the pointer whole (ADR-089): past the lift the closed hand
 * holds everywhere, the card left behind dims, and the release hands the target the same
 * envelope a share link holds.
 */
export const CardCarry: Story = {
  args: { thread: threads.trend },
  render: withCarryTarget,
  play: async ({ canvasElement }) => {
    const { handle, card, target, start } = carryScene(canvasElement);
    const html = document.documentElement;
    const drop = middleOf(target);

    const down = pointer("pointerdown", start.x, start.y, 1);
    handle.dispatchEvent(down);
    await expect(down.defaultPrevented).toBe(true);
    handle.dispatchEvent(pointer("pointermove", start.x + 3, start.y, 1));
    await expect(html).not.toHaveAttribute("data-carrying");

    target.dispatchEvent(pointer("pointermove", drop.x, drop.y, 1));
    await expect(html).toHaveAttribute("data-carrying", "card");
    await expect(getComputedStyle(target).cursor).toBe("grabbing");
    await expect(card).toHaveAttribute("data-lifted");
    await expect(getComputedStyle(card).opacity).toBe("0.35");
    const ghost = document.querySelector<HTMLElement>(".carry-ghost");
    if (!ghost) throw new Error("nothing rides the pointer");
    await expect(getComputedStyle(ghost).opacity).toBe("0.85");
    await expect(getComputedStyle(ghost).pointerEvents).toBe("none");

    target.dispatchEvent(pointer("pointerup", drop.x, drop.y));
    await expect(html).not.toHaveAttribute("data-carrying");
    await expect(card).not.toHaveAttribute("data-lifted");
    await expect(getComputedStyle(card).opacity).toBe("1");
    await expect(ghost).not.toBeInTheDocument();
    await waitFor(() => expect(heardBy(target)).toEqual(["over card", "drop card"]));
    await expect(JSON.parse(target.dataset.landed ?? "null")).toEqual({
      kind: "card",
      card: { v: 1, kind: "catalog", payload: scenarios.trend.payload },
      title: within(handle).getByRole("heading").textContent,
    });
  },
};

/** Escape puts a carried card back: the target hears it leave, and the release drops nothing. */
export const CardCarryCancels: Story = {
  args: { thread: threads.trend },
  render: withCarryTarget,
  play: async ({ canvasElement }) => {
    const { handle, card, target, start } = carryScene(canvasElement);
    const drop = middleOf(target);

    handle.dispatchEvent(pointer("pointerdown", start.x, start.y, 1));
    target.dispatchEvent(pointer("pointermove", drop.x, drop.y, 1));
    await expect(card).toHaveAttribute("data-lifted");
    await userEvent.keyboard("{Escape}");
    await expect(document.documentElement).not.toHaveAttribute("data-carrying");
    await expect(card).not.toHaveAttribute("data-lifted");

    target.dispatchEvent(pointer("pointerup", drop.x, drop.y));
    await waitFor(() => expect(heardBy(target)).toEqual(["over card", "leave"]));
    await expect(target).not.toHaveAttribute("data-landed");
  },
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
  args: { thread: threads.trend, dictation: { open: true } },
};

/** An open microphone picker takes Escape first; the next Escape cancels dictation itself. */
export const DictationPickerEscapes: Story = {
  args: { thread: threads.trend, dictation: { open: true } },
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
  args: { thread: threads.trend, dictation: { open: true }, width: 420 },
};

/** Uses your real microphone; the browser asks for permission first. */
export const DictationLiveMicrophone: Story = {
  args: { thread: threads.trend, dictation: { open: true, source: "microphone" } },
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

// Highlights the first agent paragraph and rests the pointer on it until the thread shows the
// open hand.
async function readyHighlight(canvasElement: HTMLElement) {
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
  return { scroller, paragraph, range, box, x, y };
}

function highlighted(): string | undefined {
  return document.getSelection()?.toString();
}

/**
 * A highlight is something to pick up: an open hand over it, a closed one while it is held, and
 * the I-beam for as long as the highlight is still being made.
 */
export const HighlightGrab: Story = {
  args: { thread: threads.trend },
  play: async ({ canvasElement }) => {
    const { scroller, paragraph, range, box, x, y } = await readyHighlight(canvasElement);
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

/**
 * A highlight carries its text (ADR-089): a quote chip rides the pointer, the highlight stays
 * where it was, and the target gets the words. A click on the highlight, with no carry, clears
 * it as it always has, and the browser's own drag never starts inside the thread.
 */
export const HighlightCarry: Story = {
  args: { thread: threads.trend },
  render: withCarryTarget,
  play: async ({ canvasElement }) => {
    const { paragraph, x, y } = await readyHighlight(canvasElement);
    const target = within(canvasElement).getByRole("region", { name: "Carry target" });
    const drop = middleOf(target);
    const words = paragraph.textContent;

    const down = pointer("pointerdown", x, y, 1);
    paragraph.dispatchEvent(down);
    await expect(down.defaultPrevented).toBe(true);
    target.dispatchEvent(pointer("pointermove", drop.x, drop.y, 1));
    await expect(document.documentElement).toHaveAttribute("data-carrying", "text");
    await expect(document.querySelector(".carry-ghost .carry-quote")).toHaveTextContent(
      `“${words}”`,
    );
    await expect(highlighted()).toBe(words);

    target.dispatchEvent(pointer("pointerup", drop.x, drop.y));
    await expect(document.documentElement).not.toHaveAttribute("data-carrying");
    await expect(document.querySelector(".carry-ghost")).toBeNull();
    await waitFor(() => expect(heardBy(target)).toEqual(["over text", "drop text"]));
    await expect(JSON.parse(target.dataset.landed ?? "null")).toEqual({
      kind: "text",
      text: words,
    });
    await expect(highlighted()).toBe(words);

    paragraph.dispatchEvent(pointer("pointermove", x, y));
    paragraph.dispatchEvent(pointer("pointerdown", x, y, 1));
    paragraph.dispatchEvent(pointer("pointerup", x, y));
    paragraph.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
    await expect(highlighted()).toBe("");
    await expect(heardBy(target)).toEqual(["over text", "drop text"]);

    const drag = new DragEvent("dragstart", { bubbles: true, cancelable: true });
    paragraph.dispatchEvent(drag);
    await expect(drag.defaultPrevented).toBe(true);
  },
};
