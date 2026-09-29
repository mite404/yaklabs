import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentTree } from "./AgentTree";
import { AgentWorking } from "./AgentWorking";
import { InLine, Labeled, Stage } from "./motionStage";

const meta = {
  title: "Motion/Agent tree",
  component: AgentTree,
  parameters: { layout: "centered" },
  argTypes: {
    duration: { control: { type: "range", min: 100, max: 2000, step: 50 } },
  },
  args: { duration: 1500 },
  decorators: [(Story) => <Stage>{Story()}</Stage>],
} satisfies Meta<typeof AgentTree>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The three-pill tree at its real size, climbing. Scrub the duration in Controls. */
export const Default: Story = {};

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

/** In place, at the shipped default speed: beside a line of text, as in a thread or the sidebar. */
export const InContext: Story = {
  render: () => (
    <InLine>
      <AgentTree />
    </InLine>
  ),
};
