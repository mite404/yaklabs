import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { AgentTree } from "./AgentTree";
import "./AgentTree.cues.css";
import { AgentWorking } from "./AgentWorking";
import { InLine, Labeled, Stage } from "./motionStage";

const SPEEDS = [1500, 1800, 2000, 2200, 2500];

// The base's departure cues under trial (AgentTree.cues.css), beside the shipped one.
const CUES = [
  { caption: "shipped: together", className: undefined },
  { caption: "lead: base waits 8%", className: "agent-tree-cue-lead" },
  { caption: "half: base waits 13%", className: "agent-tree-cue-half" },
];

// Three tree glyphs, one per cue, at one duration; `zoom` blows the pixels up without
// resampling them, so the whole-pixel geometry stays crisp.
function CueRow({ duration, zoom }: { duration: number; zoom?: number }): ReactNode {
  return CUES.map(({ caption, className }) => (
    <Labeled key={caption} caption={caption}>
      <div className={className} style={{ zoom, lineHeight: 0 }}>
        <AgentTree duration={duration} />
      </div>
    </Labeled>
  ));
}

const meta = {
  title: "Motion/Agent tree",
  component: AgentTree,
  parameters: { layout: "centered" },
  argTypes: {
    duration: { control: { type: "range", min: 100, max: 3000, step: 50 } },
    // Only a screen reader hears it; a control that changes nothing on screen reads as broken.
    label: { table: { disable: true } },
  },
  args: { duration: 2000 },
  decorators: [(Story) => <Stage>{Story()}</Stage>],
} satisfies Meta<typeof AgentTree>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The three-pill tree at its real size, climbing. Scrub the duration in Controls. */
export const Default: Story = {};

/** The same climb at five lengths, side by side, to pick the pacing by eye. */
export const Speeds: Story = {
  // Each glyph here has its own fixed length, so the duration control would do nothing.
  parameters: { controls: { exclude: ["duration"] } },
  render: () => (
    <>
      {SPEEDS.map((ms) => (
        <Labeled key={ms} caption={`${ms}ms`}>
          <AgentTree duration={ms} />
        </Labeled>
      ))}
    </>
  ),
};

/** The base's departure, three ways: with the top branch (shipped), a third of the way into the
 * top's entry (lead), or once the top has landed (half). Scrub the duration in Controls. */
export const Cues: Story = {
  render: (args) => <CueRow duration={args.duration ?? 2000} />,
};

/** The same three cues blown up 8x and slowed to 6s, to judge the overlap frame by frame. */
export const CuesMagnified: Story = {
  args: { duration: 6000 },
  argTypes: {
    duration: { control: { type: "range", min: 1000, max: 12000, step: 250 } },
  },
  render: (args) => <CueRow duration={args.duration ?? 6000} zoom={8} />,
};

/** Beside the working wave at the same speed: one palette, one pacing, two shapes. */
export const WithWave: Story = {
  render: (args) => (
    <>
      <Labeled caption="tree">
        <AgentTree duration={args.duration} />
      </Labeled>
      <Labeled caption="wave">
        <AgentWorking duration={args.duration} />
      </Labeled>
    </>
  ),
};

/** In place, beside a line of text as in a thread or the sidebar; opens at the shipped default. */
export const InContext: Story = {
  render: (args) => (
    <InLine>
      <AgentTree {...args} />
    </InLine>
  ),
};
