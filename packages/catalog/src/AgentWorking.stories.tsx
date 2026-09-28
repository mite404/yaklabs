import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { AgentWorking } from "./AgentWorking";

// Review stages share one surface so the greens are judged against the real paper.
function Stage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 32,
        alignItems: "flex-end",
        padding: 24,
        background: "var(--paper)",
      }}
    >
      {children}
    </div>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <span style={{ font: "12px var(--font-text)", color: "var(--soft-ink)" }}>{children}</span>
  );
}

function Labeled({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
      {children}
      <Caption>{caption}</Caption>
    </div>
  );
}

const SPEEDS = [150, 300, 600, 1200];
const FRAMES = Array.from({ length: 10 }, (_, i) => i / 10); // → 0, 0.1 … 0.9

const meta = {
  title: "Motion/Agent working",
  component: AgentWorking,
  parameters: { layout: "centered" },
  argTypes: {
    duration: { control: { type: "range", min: 100, max: 2000, step: 50 } },
    phase: { control: false },
  },
  args: { duration: 150 },
  decorators: [(Story) => <Stage>{Story()}</Stage>],
} satisfies Meta<typeof AgentWorking>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The glyph at its real size, looping. Scrub the duration in Controls. */
export const Default: Story = {};

/** The same wave at four speeds, side by side, to pick the timing by eye. */
export const Speeds: Story = {
  render: () => (
    <>
      {SPEEDS.map((ms) => (
        <Labeled key={ms} caption={`${ms}ms`}>
          <AgentWorking duration={ms} />
        </Labeled>
      ))}
    </>
  ),
};

/** A contact sheet: one cycle frozen at ten points, enlarged, to check the wave frame by frame. */
export const Frames: Story = {
  render: (args) => (
    <>
      {FRAMES.map((phase) => (
        <Labeled key={phase} caption={`${Math.round(phase * 100)}%`}>
          <span style={{ zoom: 4, display: "inline-flex" }}>
            <AgentWorking
              duration={args.duration}
              phase={phase}
              label={`Frame at ${phase * 100}%`}
            />
          </span>
        </Labeled>
      ))}
    </>
  ),
};

/** In place: beside a line of text, the way it would sit in a thread or the sidebar. */
export const InContext: Story = {
  render: (args) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        font: "14px var(--font-text)",
        color: "var(--soft-ink)",
      }}
    >
      <AgentWorking {...args} />
      Kay is working on it
    </div>
  ),
};
