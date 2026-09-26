import { threads } from "@yaklabs/catalog/thread";
import { describe, expect, it } from "vitest";
import { commandSchema, noticeSchema } from "./protocol";

const attachment = {
  turnId: "a1",
  label: "Net profit · Sep 14–20",
  state: { measure: "Net profit" },
};
const gatewayInit = (baseUrl: string) => ({ kind: "init", agent: { kind: "gateway", baseUrl } });
const send = {
  kind: "send",
  requestId: "r1",
  conversationId: "demo",
  event: { kind: "message", text: "Why is Saturday high?", attachments: [attachment] },
};

describe("commandSchema", () => {
  it("accepts a send whose card choice rides along", () => {
    const parsed = commandSchema.parse(send); // → Command
    expect(parsed).toEqual(send);
  });

  it("rejects a command whose kind it does not know", () => {
    expect(commandSchema.safeParse({ kind: "delete", conversationId: "demo" }).success).toBe(false);
  });

  it("rejects a send whose event is malformed", () => {
    const missingAttachments = { ...send, event: { kind: "message", text: "Hi" } };
    const unknownEvent = { ...send, event: { kind: "shout", text: "Hi" } };
    expect(commandSchema.safeParse(missingAttachments).success).toBe(false);
    expect(commandSchema.safeParse(unknownEvent).success).toBe(false);
  });

  it("accepts a rejected question even when the question itself was missing", () => {
    const event = { kind: "question-rejected", reason: "no options", question: undefined };
    expect(commandSchema.safeParse({ ...send, event }).success).toBe(true);
  });

  it("opens a conversation from a seed thread with an interactive card", () => {
    const open = { kind: "open", conversationId: "demo", seed: threads.profit };
    expect(commandSchema.parse(open)).toEqual(open);
  });

  it("only takes an absolute gateway address", () => {
    expect(commandSchema.safeParse(gatewayInit("http://localhost:5173")).success).toBe(true);
    expect(commandSchema.safeParse(gatewayInit("/api")).success).toBe(false);
  });
});

describe("noticeSchema", () => {
  it("rejects a conversation whose update time is not an instant", () => {
    const conversation = { id: "demo", title: "Demo", messages: [], updatedAt: "yesterday" };
    expect(noticeSchema.safeParse({ kind: "opened", conversation }).success).toBe(false);
  });

  it("rejects a stored turn with an unknown role", () => {
    const messages = [{ id: "s1", role: "system", text: "Hi", time: "9:00" }];
    const conversation = {
      id: "demo",
      title: "Demo",
      messages,
      updatedAt: new Date(0).toISOString(),
    };
    expect(noticeSchema.safeParse({ kind: "opened", conversation }).success).toBe(false);
  });
});
