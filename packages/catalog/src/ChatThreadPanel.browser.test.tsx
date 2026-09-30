import { createRef } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { Agent, AgentEvent } from "./agent";
import { ChatThreadPanel } from "./ChatThreadPanel";
import type { ReplyChunk } from "./reply";
import { threads, type ThreadHandle } from "./thread";

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

// One reply, driven by hand: `chunk` delivers words or an event, `fail` breaks it off, `finish`
// ends it with nothing more to say. Each call to `respond` pushes a fresh one, so a test can hold
// several replies open at once and drive each on its own. It never listens for Stop, as a slow
// source would not, so Stop has to show without it.
type ControlledReply = {
  event: AgentEvent;
  chunk: (chunk: ReplyChunk) => void;
  fail: (error: unknown) => void;
  finish: () => void;
};

function controlledAgent(): { agent: Agent; replies: ControlledReply[] } {
  const replies: ControlledReply[] = [];
  const agent: Agent = {
    respond(event: AgentEvent) {
      let deliver: ((result: IteratorResult<ReplyChunk>) => void) | undefined;
      let raise: ((error: unknown) => void) | undefined;
      const next = () =>
        new Promise<IteratorResult<ReplyChunk>>((resolve, reject) => {
          deliver = resolve;
          raise = reject;
        });
      replies.push({
        event,
        chunk: (value) => deliver?.({ value, done: false }),
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
  expect(host.textContent).toContain("Could not start");
  expect(host.textContent).toContain("Your request is still here; try again when you're ready.");
  expect(host.querySelector('[aria-busy="true"]')).toBeNull();
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

function agentTurns(): HTMLElement[] {
  return [...host.querySelectorAll<HTMLElement>(".turn-agent")];
}

function button(name: string): HTMLButtonElement | null {
  return host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
}

it("stops every reply in flight at once, marking each stopped, even one whose source is slow", async () => {
  const { agent, replies } = controlledAgent();
  flushSync(() => {
    root.render(<ChatThreadPanel thread={threads.trend} agent={agent} />);
  });

  await userEvent.type(field(), "First?{Enter}");
  await userEvent.type(field(), "Second?{Enter}");
  await vi.waitFor(() => {
    expect(replies).toHaveLength(2);
  });
  replies[0]?.chunk({ kind: "step", step: { id: "a", label: "North", status: "running" } });
  replies[1]?.chunk("Partly said.");
  await vi.waitFor(() => {
    expect(host.textContent).toContain("Partly said.");
  });

  const stop = button("Stop");
  if (!stop) throw new Error("no Stop while replies stream");
  await userEvent.click(stop);
  await vi.waitFor(() => {
    expect(host.textContent?.match(/Stopped by you/g)).toHaveLength(2);
  });
  expect(host.querySelector('[aria-busy="true"]')).toBeNull();
  expect(button("Stop")).toBeNull();
  expect(host.textContent).toContain("Partly said.");
  expect(host.textContent).toContain("1 step");

  // A chunk that arrives after Stop changes nothing.
  replies[1]?.chunk(" More words.");
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(host.textContent).not.toContain("More words.");
});

it("tries a cut-off reply again as a new turn, with the same request and no second bubble", async () => {
  const { agent, replies } = controlledAgent();
  flushSync(() => {
    root.render(<ChatThreadPanel thread={threads.trend} agent={agent} />);
  });

  await userEvent.type(field(), "And next week?{Enter}");
  await vi.waitFor(() => {
    expect(replies).toHaveLength(1);
  });
  replies[0]?.chunk("Monday looks");
  // Each reply takes its next chunk only once it has folded the last one.
  await vi.waitFor(() => {
    expect(host.textContent).toContain("Monday looks");
  });
  replies[0]?.fail(new Error("the line dropped"));
  await vi.waitFor(() => {
    expect(host.textContent).toContain("Interrupted · Incomplete answer");
  });

  const users = host.querySelectorAll(".turn-user").length;
  const retry = [...host.querySelectorAll("button")].find(
    (each) => each.textContent === "Try again",
  );
  if (!retry) throw new Error("no Try again");
  await userEvent.click(retry);
  await vi.waitFor(() => {
    expect(replies).toHaveLength(2);
  });
  expect(replies[1]?.event).toEqual(replies[0]?.event);
  replies[1]?.chunk("Monday looks quiet.");
  await vi.waitFor(() => {
    expect(host.textContent).toContain("Monday looks quiet.");
  });
  expect(host.querySelectorAll(".turn-user")).toHaveLength(users);
  expect(host.textContent).toContain("Interrupted · Incomplete answer");
  replies[1]?.finish();
});

it("docks a question from the stream, and shows the answer with the question it answered", async () => {
  const { agent, replies } = controlledAgent();
  const handle = createRef<ThreadHandle>();
  flushSync(() => {
    root.render(<ChatThreadPanel thread={threads.trend} agent={agent} ref={handle} />);
  });

  await userEvent.type(field(), "Plan the forecast{Enter}");
  await vi.waitFor(() => {
    expect(replies).toHaveLength(1);
  });
  replies[0]?.chunk({
    kind: "question",
    question: {
      question: "How many weeks ahead should it forecast?",
      options: [{ label: "Four weeks" }],
      answer: { placeholder: "Or type a number of weeks" },
    },
  });
  await vi.waitFor(() => {
    expect(host.querySelector('[aria-label="Needs attention"]')).not.toBeNull();
  });
  replies[0]?.finish();

  handle.current?.answer("Four weeks");
  await vi.waitFor(() => {
    expect(host.querySelector('[aria-label="Your answers"]')?.textContent).toBe(
      "How many weeks ahead should it forecast?Four weeks",
    );
  });
  expect(host.querySelector('[aria-label="Needs attention"]')).toBeNull();
  expect(replies[1]?.event).toEqual({ kind: "answer", text: "Four weeks" });
  replies[1]?.finish();
});

it("sends a malformed question from the stream back to the agent, never to the dock", async () => {
  const { agent, replies } = controlledAgent();
  flushSync(() => {
    root.render(<ChatThreadPanel thread={threads.trend} agent={agent} />);
  });

  await userEvent.type(field(), "Plan the forecast{Enter}");
  await vi.waitFor(() => {
    expect(replies).toHaveLength(1);
  });
  replies[0]?.chunk({ kind: "question", question: { question: "" } });
  await vi.waitFor(() => {
    expect(replies).toHaveLength(2);
  });
  expect(replies[1]?.event.kind).toBe("question-rejected");
  expect(host.querySelector('[aria-label="Needs attention"]')).toBeNull();
  replies[0]?.finish();
  replies[1]?.finish();
});

it("lets a host set the draft and send it in one go", async () => {
  const { agent, replies } = controlledAgent();
  const handle = createRef<ThreadHandle>();
  flushSync(() => {
    root.render(<ChatThreadPanel thread={threads.trend} agent={agent} ref={handle} />);
  });

  handle.current?.setDraft("Scripted request");
  handle.current?.send();
  await vi.waitFor(() => {
    expect(replies).toHaveLength(1);
  });
  expect(replies[0]?.event).toMatchObject({ kind: "message", text: "Scripted request" });
  await vi.waitFor(() => {
    expect(host.textContent).toContain("Scripted request");
  });
  expect(field().value).toBe("");
  replies[0]?.finish();
});

it("leaves no turn behind for a reply that ends having said nothing", async () => {
  const { agent, replies } = controlledAgent();
  flushSync(() => {
    root.render(<ChatThreadPanel thread={threads.trend} agent={agent} />);
  });
  const before = agentTurns().length;

  await userEvent.type(field(), "Anything?{Enter}");
  await vi.waitFor(() => {
    expect(agentTurns()).toHaveLength(before + 1);
  });
  replies[0]?.chunk({ kind: "activity", text: "Thinking it over." });
  await vi.waitFor(() => {
    expect(host.textContent).toContain("Thinking it over.");
  });
  replies[0]?.finish();
  await vi.waitFor(() => {
    expect(agentTurns()).toHaveLength(before);
  });
});
