import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Modal } from "./Modal";

// A container the modal covers, as the thread panel is for dictation.
function Stage() {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ position: "relative", width: 560, height: 360, background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: 12, padding: 20 }}>
      <button className="btn btn-sm" onClick={() => setOpen(true)}>Open modal</button>
      {open && (
        <Modal labelledBy="demo-title" onClose={() => setOpen(false)}>
          <div style={{ width: 360, padding: 18 }}>
            <h3 id="demo-title" style={{ margin: "0 0 8px", fontSize: 15 }}>Pause the thread?</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13 }}>Tab stays inside, Escape closes, and focus returns to the button.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-sm" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-sm" onClick={() => setOpen(false)}>Continue</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

const meta = {
  title: "Foundations/Modal",
  component: Stage,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Stage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Covers only its container, with a scrim; dictation is built on this (ADR-062). */
export const Default: Story = {};
