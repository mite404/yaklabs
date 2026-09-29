import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { Agent, AgentEvent } from "./agent";
import { ChatThreadPanel } from "./ChatThreadPanel";
import { threads } from "./thread";

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  root.unmount();
  host.remove();
});

// One reply, driven by hand: `chunk` delivers text, `fail` breaks it off, `finish` ends it with
// nothing more to say. Each call to `respond` pushes a fresh one, so a test can hold several
// replies open at once and drive each on its own.
type ControlledReply = {
  chunk: (text: string) => void;
  fail: (error: unknown) => void;
  finish: () => void;
};

function controlledAgent(): { agent: Agent; replies: ControlledReply[] } {
  const replies: ControlledReply[] = [];
  const agent: Agent = {
    respond(_event: AgentEvent) {
      let deliver: ((result: IteratorResult<string>) => void) | undefined;
      let raise: ((error: unknown) => void) | undefined;
      const next = () =>
        new Promise<IteratorResult<string>>((resolve, reject) => {
          deliver = resolve;
          raise = reject;
        });
      replies.push({
        chunk: (text) => deliver?.({ value: text, done: false }),
        fail: (error) => raise?.(error),
        finish: () => deliver?.({ value: "", done: true }),
      });
      return { [Symbol.asyncIterator]: () => ({ next }) };
    },
  };
  return { agent, replies };
}

function pendingRows(): HTMLElement[] {
  return [...host.querySelectorAll<HTMLElement>(".turn-pending")];
}

function field(): HTMLTextAreaElement {
  const found = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message"]');
  if (!found) throw new Error("no compose box");
  return found;
}

it("shows a quiet Thinking indicator while a reply is pending, and clears it on the first content", async () => {
  const { agent, replies } = controlledAgent();
  flushSync(() => {
    root.render(<ChatThreadPanel thread={threads.trend} agent={agent} />);
  });

  await userEvent.type(field(), "And next week?{Enter}");
  await vi.waitFor(() => {
    expect(pendingRows()).toHaveLength(1);
  });
  expect(pendingRows()[0]?.textContent).toContain("Thinking");
  expect(host.textContent).not.toContain("Saturday leads.");

  replies[0]?.chunk("Saturday leads.");
  await vi.waitFor(() => {
    expect(pendingRows()).toHaveLength(0);
  });
  expect(host.textContent).toContain("Saturday leads.");
  replies[0]?.finish();
});

it("clears the indicator on a reply that fails before any content, leaving no stale animation", async () => {
  const { agent, replies } = controlledAgent();
  flushSync(() => {
    root.render(<ChatThreadPanel thread={threads.trend} agent={agent} />);
  });

  await userEvent.type(field(), "And next week?{Enter}");
  await vi.waitFor(() => {
    expect(pendingRows()).toHaveLength(1);
  });

  replies[0]?.fail(new Error("the gateway refused"));
  await vi.waitFor(() => {
    expect(pendingRows()).toHaveLength(0);
  });
  expect(host.textContent).toContain("I couldn't finish that reply. Try again in a moment.");
});

it("tracks each pending reply on its own, not one shared flag", async () => {
  const { agent, replies } = controlledAgent();
  flushSync(() => {
    root.render(<ChatThreadPanel thread={threads.trend} agent={agent} />);
  });

  await userEvent.type(field(), "First?{Enter}");
  await vi.waitFor(() => {
    expect(pendingRows()).toHaveLength(1);
  });
  await userEvent.type(field(), "Second?{Enter}");
  await vi.waitFor(() => {
    expect(pendingRows()).toHaveLength(2);
  });

  // The second reply lands first; only its own indicator clears, the first's stays put.
  replies[1]?.chunk("Second answer.");
  await vi.waitFor(() => {
    expect(pendingRows()).toHaveLength(1);
  });
  expect(host.textContent).toContain("Second answer.");
  expect(host.textContent).not.toContain("First answer.");

  replies[0]?.chunk("First answer.");
  await vi.waitFor(() => {
    expect(pendingRows()).toHaveLength(0);
  });
  expect(host.textContent).toContain("First answer.");
  replies[0]?.finish();
  replies[1]?.finish();
});
