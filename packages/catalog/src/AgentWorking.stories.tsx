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

const SPEEDS = [650, 850, 1200, 1350, 1500];

const meta = {
  title: "Motion/Agent working",
  component: AgentWorking,
  parameters: { layout: "centered" },
  argTypes: {
    duration: { control: { type: "range", min: 100, max: 2000, step: 50 } },
  },
  args: { duration: 1200 },
  decorators: [(Story) => <Stage>{Story()}</Stage>],
} satisfies Meta<typeof AgentWorking>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The glyph at its real size, looping. Scrub the duration in Controls. */
export const Default: Story = {};

/** The same wave at five speeds, side by side, to pick the timing by eye. */
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

/** In place, at the shipped default speed: beside a line of text, as in a thread or the sidebar. */
export const InContext: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        font: "14px var(--font-text)",
        color: "var(--soft-ink)",
      }}
    >
      <AgentWorking />
      Kay is working on it
    </div>
  ),
};
