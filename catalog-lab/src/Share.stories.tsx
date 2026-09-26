import type { Meta, StoryObj } from "@storybook/react-vite";
import { encodeCard } from "./share";
import { ShareView } from "./ShareView";
import { profitCard } from "./thread";
import { scenarios } from "./fixtures";

const meta = {
  title: "Share/Public page",
  component: ShareView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ShareView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** What a share link opens: the card comes from this page's own link (ADR-064). */
export const FromLink: Story = {};

/** An interactive card shared on its own; its slider still works. */
export const InteractiveCard: Story = {
  args: { hash: "#" + encodeCard({ v: 1, kind: "interactive", payload: profitCard }) },
};

/** A static catalog card shared on its own. */
export const CatalogCard: Story = {
  args: { hash: "#" + encodeCard({ v: 1, kind: "catalog", payload: scenarios.trend.payload }) },
};

/** A garbled or edited link: an honest notice, never a broken view. */
export const BrokenLink: Story = { args: { hash: "#c=garbled" } };
