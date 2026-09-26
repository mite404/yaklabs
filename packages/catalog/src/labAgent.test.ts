import { expect, it } from "vitest";
import type { AgentEvent } from "./agent";
import { createLabAgent } from "./labAgent";
import { threads } from "./thread";

const agent = createLabAgent({ replyDelayMs: 0, wordMs: 0 });

// Everything the agent streams for one event, joined as the thread would show it.
async function reply(event: AgentEvent, signal = new AbortController().signal): Promise<string> {
  let text = "";
  for await (const chunk of agent.respond(event, signal)) text += chunk;
  return text;
}

it("streams a reply in chunks that join into whole sentences", async () => {
  const chunks: string[] = [];
  for await (const chunk of agent.respond(
    { kind: "answer", text: "4 weeks" },
    new AbortController().signal,
  ))
    chunks.push(chunk);
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.join("")).toBe('Got it: "4 weeks". Carrying on from there.');
});

it("stays quiet when a message carries no card choices", async () => {
  expect(await reply({ kind: "message", text: "thanks", attachments: [] })).toBe("");
});

it("asks in plain words when its question was rejected, reusing the sound part", async () => {
  const text = await reply({
    kind: "question-rejected",
    reason: "answer.placeholder: too long",
    question: threads.malformed.awaiting,
  });
  expect(text).toMatch(
    /^A forecast view isn't in the catalog yet\. How should I handle it\? Tell me/,
  );
});

it.each([null, "Should I?", { question: 42 }, { question: "  " }])(
  "asks for context when the rejected question %j has no wording to reuse",
  async (question) => {
    const text = await reply({ kind: "question-rejected", reason: "question: required", question });
    expect(text).toMatch(/^I need a bit more context before I carry on\./);
  },
);

it("stops streaming as soon as the reply is abandoned", async () => {
  const controller = new AbortController();
  controller.abort();
  expect(await reply({ kind: "answer", text: "4 weeks" }, controller.signal)).toBe("");
});
