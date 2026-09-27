import type { Meta, StoryObj } from "@storybook/react-vite";
import { CatalogCard } from "./CatalogCard";
import { App } from "./App";
import { scenarios } from "./fixtures";

const meta = {
  title: "Catalog/Approved answers",
  component: CatalogCard,
} satisfies Meta<typeof CatalogCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Trend: Story = { args: { payload: scenarios.trend.payload } };
export const Snapshot: Story = {
  args: { payload: scenarios.snapshot.payload },
};
export const Comparison: Story = {
  args: { payload: scenarios.comparison.payload },
};
export const ExactValues: Story = {
  args: { payload: scenarios.table.payload },
};
export const SparseFallback: Story = {
  args: { payload: scenarios.sparse.payload },
};
export const MissingData: Story = {
  args: { payload: scenarios.missing.payload },
};
export const Empty: Story = { args: { payload: scenarios.empty.payload } };
export const Unsupported: Story = {
  args: { payload: scenarios.unsupported.payload },
};
export const UnsafeProps: Story = {
  args: { payload: scenarios.unsafe.payload },
};
export const ProductEvaluation: Story = {
  args: { payload: scenarios.trend.payload },
  render: () => <App />,
};
