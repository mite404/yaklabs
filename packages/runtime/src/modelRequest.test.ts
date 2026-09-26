import type { AgentEvent } from "@yaklabs/catalog/agent";
import { profitCard } from "@yaklabs/catalog/thread";
import { gatewayRequestSchema } from "gateway/contract";
import { describe, expect, it } from "vitest";
import { toModelRequest } from "./modelRequest";
import type { Conversation } from "./protocol";
import { netProfitChoice, profitThread } from "./testing";

const demo: Conversation = {
  id: "demo",
  title: profitThread.title,
  updatedAt: "2026-09-26T10:02:00.000Z",
  messages: profitThread.messages,
};

// The user stepped the card to net profit, then asked about it.
const ask: AgentEvent = {
  kind: "message",
  text: "Why is Saturday high?",
  attachments: [netProfitChoice],
};

// A long thread of alternating turns: u1, a1, u2, a2, …
const longThread = (turns: number): Conversation => ({
  ...demo,
  messages: Array.from({ length: turns }, (_, i) =>
    i % 2 === 0
      ? { id: `u${i}`, role: "user", text: `Question ${i}`, time: "9:00" }
      : { id: `a${i}`, role: "agent", text: `Answer ${i}`, time: "9:00" },
  ),
});

describe("toModelRequest shows the model the card", () => {
  it("puts the card view the user set in the final user turn", () => {
    const { messages } = toModelRequest(demo, ask);
    expect(messages.at(-1)).toEqual({
      role: "user",
      content: "Why is Saturday high?\n[Card view: Net profit · Sep 14–20]",
    });
  });

  it("shows the model the card it put in the thread, as JSON", () => {
    const shown = toModelRequest(demo, ask).messages.at(1);
    expect(shown?.role).toBe("assistant");
    expect(shown?.content).toContain("Here's last week's profit by day.");
    expect(shown?.content).toContain(`\`\`\`json\n${JSON.stringify(profitCard)}\n\`\`\``);
  });

  it("keeps the stored turns in order, with the event last", () => {
    const { messages } = toModelRequest(demo, ask);
    expect(messages.map((turn) => turn.role)).toEqual(["user", "assistant", "user"]);
    expect(messages.at(0)?.content).toBe(profitThread.messages.at(0)?.text);
  });
});

describe("toModelRequest speaks the gateway's language", () => {
  it("builds a request the gateway accepts", () => {
    expect(gatewayRequestSchema.safeParse(toModelRequest(demo, ask)).success).toBe(true);
  });

  it("tells the model what a card-view line means", () => {
    expect(toModelRequest(demo, ask).system).toContain("[Card view: <label>]");
  });

  it("keeps the newest turns that fit, starting with the user", () => {
    const request = toModelRequest(longThread(260), ask);
    expect(gatewayRequestSchema.safeParse(request).success).toBe(true);
    expect(request.messages.at(0)?.role).toBe("user");
    expect(request.messages.at(-2)?.content).toBe("Answer 259");
  });

  it("refuses a message with nothing in it", () => {
    const empty: AgentEvent = { kind: "message", text: " ", attachments: [] };
    expect(() => toModelRequest(demo, empty)).toThrow("nothing to answer");
  });
});

describe("toModelRequest carries what rode along", () => {
  it("names the card choices and files an earlier user turn carried", () => {
    const earlier: Conversation = {
      ...demo,
      messages: [
        ...demo.messages,
        {
          id: "u2",
          role: "user",
          text: "And this?",
          time: "10:03",
          attachments: [netProfitChoice],
          files: [{ id: "u2-f1", label: "till-roll.png" }],
        },
      ],
    };
    const { messages } = toModelRequest(earlier, { kind: "answer", text: "Yes" });
    expect(messages.at(-2)?.content).toBe(
      "And this?\n[Card view: Net profit · Sep 14–20]\n[Attached file: till-roll.png]",
    );
    expect(messages.at(-1)).toEqual({ role: "user", content: "Yes" });
  });

  it("names a file sent with the message", () => {
    const withFile: AgentEvent = {
      kind: "message",
      text: "",
      attachments: [],
      files: [{ name: "shot.png", type: "image/png", size: 2048 }],
    };
    expect(toModelRequest(demo, withFile).messages.at(-1)?.content).toBe(
      "[Attached file: shot.png]",
    );
  });
});

describe("toModelRequest after a rejected question", () => {
  it("asks the agent to ask again in plain words when its question was rejected", () => {
    const rejected: AgentEvent = {
      kind: "question-rejected",
      reason: "answer.placeholder is too long",
      question: { question: "How should I handle it?" },
    };
    const last = toModelRequest(demo, rejected).messages.at(-1);
    expect(last?.role).toBe("user");
    expect(last?.content).toContain("Ask again in plain words");
    expect(last?.content).toContain("Why it failed: answer.placeholder is too long");
    expect(last?.content).toContain('{"question":"How should I handle it?"}');
  });
});
