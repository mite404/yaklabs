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
const VARIANTS = [
  { pattern: "wave", cells: 4 },
  { pattern: "orbit", cells: 4 },
  { pattern: "wave", cells: 6 },
  { pattern: "orbit", cells: 6 },
] as const;

const meta = {
  title: "Motion/Agent working",
  component: AgentWorking,
  parameters: { layout: "centered" },
  argTypes: {
    duration: { control: { type: "range", min: 100, max: 2000, step: 50 } },
    pattern: { control: "inline-radio", options: ["wave", "orbit"] },
    cells: { control: "inline-radio", options: [4, 6] },
  },
  args: { duration: 1500, pattern: "wave", cells: 4 },
  decorators: [(Story) => <Stage>{Story()}</Stage>],
} satisfies Meta<typeof AgentWorking>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The glyph at its real size, looping. Scrub the duration, pattern and cells in Controls. */
export const Default: Story = {};

/** Clockwise from the top left square: a comet with a trail, no rest. */
export const Orbit: Story = { args: { pattern: "orbit" } };

/** Six squares, two columns of three, in the same 12px height, running the wave. */
export const Six: Story = { args: { cells: 6 } };

/** Six squares on the clockwise orbit: every square sits on the ring, so the lap has six stops. */
export const SixOrbit: Story = { args: { cells: 6, pattern: "orbit" } };

/** All four variants side by side at the same speed, to compare. */
export const Compare: Story = {
  render: (args) => (
    <>
      {VARIANTS.map(({ pattern, cells }) => (
        <Labeled key={`${pattern}-${cells}`} caption={`${pattern}, ${cells}`}>
          <AgentWorking duration={args.duration} pattern={pattern} cells={cells} />
        </Labeled>
      ))}
    </>
  ),
};

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
