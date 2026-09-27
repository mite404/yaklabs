import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Disclosure } from "./Disclosure";

// A live wrapper, since the disclosure's state belongs to its caller.
function Section({ startOpen }: { startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div
      style={{
        width: 420,
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        borderRadius: 12,
        padding: "4px 0 12px",
      }}
    >
      <Disclosure
        open={open}
        onToggle={() => setOpen(!open)}
        summary={<strong style={{ fontSize: 13 }}>How I got this</strong>}
      >
        <p style={{ margin: "12px 16px 0", fontSize: 13 }}>
          Read last week's orders, grouped them by day, and subtracted refunds.
        </p>
      </Disclosure>
    </div>
  );
}

const meta = {
  title: "Foundations/Disclosure",
  component: Section,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Section>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Open: a flush line separates the header from the body, 8px below the hover fill. */
export const Open: Story = { args: { startOpen: true } };

/** Folded to its header: no line, the chevron points right. */
export const Folded: Story = { args: { startOpen: false } };
