import type { Meta, StoryObj } from "@storybook/react-vite";
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

/** "Needs you" items lead the recap, ahead of completed work. */
export const RecapNeedsYou: Story = {
  args: {
    thread: threads.fallbacks,
    now: NOW,
    activity: { active: true, lastUserInputAt: NOW - 25 * MINUTE },
  },
};

export const RecapNarrow: Story = {
  args: { ...RecapNeedsYou.args, width: 420 },
};

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
