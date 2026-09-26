import type { AgentEvent, SharedFile } from "@yaklabs/catalog/agent";
import type { CardAttachment } from "@yaklabs/catalog/interactive";
import type { Thread, ThreadMessage } from "@yaklabs/catalog/thread";
import { z } from "zod";

// The catalog owns these shapes. Each schema is typed against the catalog's own type, so a
// field the catalog adds or retypes fails to compile here until the schema learns it.
const idSchema = z.string().min(1);

const cardAttachmentSchema: z.ZodType<CardAttachment> = z.object({
  turnId: z.string(),
  label: z.string(),
  state: z.object({ measure: z.string() }),
});

const sharedFileSchema: z.ZodType<SharedFile> = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number().nonnegative(),
});

/** What the thread tells the agent (ADR-041), checked where it crosses into the worker. */
export const agentEventSchema: z.ZodType<AgentEvent> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("message"),
    text: z.string(),
    attachments: z.array(cardAttachmentSchema),
    files: z.array(sharedFileSchema).optional(),
  }),
  z.object({ kind: z.literal("answer"), text: z.string() }),
  z.object({ kind: z.literal("question-rejected"), reason: z.string(), question: z.unknown() }),
]);

/** One stored turn. Card payloads stay `unknown`: the catalog validates them when it renders. */
export const threadMessageSchema: z.ZodType<ThreadMessage> = z.discriminatedUnion("role", [
  z.object({
    id: idSchema,
    role: z.literal("user"),
    text: z.string(),
    time: z.string(),
    attachments: z.array(cardAttachmentSchema).optional(),
    files: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  }),
  z.object({
    id: idSchema,
    role: z.literal("agent"),
    text: z.string(),
    time: z.string(),
    payload: z.unknown().optional(),
    interactive: z.unknown().optional(),
    streaming: z.boolean().optional(),
  }),
]);

/** A seed thread the page can hand over when it opens a conversation for the first time. */
export const threadSchema: z.ZodType<Thread> = z.object({
  title: z.string(),
  messages: z.array(threadMessageSchema),
  recap: z.array(z.object({ text: z.string(), turnId: z.string() })).optional(),
  awaiting: z.unknown().optional(),
});

/** A conversation as the worker stores it (ADR-081). `updatedAt` is an ISO 8601 instant. */
export const conversationSchema = z.object({
  id: idSchema,
  title: z.string(),
  messages: z.array(threadMessageSchema),
  updatedAt: z.iso.datetime(),
});

/** One row of the conversation list: enough to draw it without loading every message. */
export const conversationSummarySchema = z.object({
  id: idSchema,
  title: z.string(),
  updatedAt: z.iso.datetime(),
  preview: z.string(),
});

/** Which agent answers: the scripted lab stand-in, or the model behind the gateway (ADR-085). */
export const agentSpecSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("lab") }),
  // Absolute, because the worker resolves it; the page passes its own origin (ADR-086).
  z.object({ kind: z.literal("gateway"), baseUrl: z.url() }),
]);

/** Everything the page may ask of the worker (ADR-076, ADR-086). */
export const commandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("init"), agent: agentSpecSchema }),
  z.object({ kind: z.literal("open"), conversationId: idSchema, seed: threadSchema.optional() }),
  z.object({
    kind: z.literal("send"),
    requestId: idSchema,
    conversationId: idSchema,
    event: agentEventSchema,
    accessToken: z.string().min(1).optional(),
  }),
  z.object({ kind: z.literal("abort"), requestId: idSchema }),
  z.object({ kind: z.literal("list") }),
]);

/** Everything the worker may tell the page. Replies stream as `chunk`s keyed by request. */
export const noticeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ready"), storage: z.enum(["opfs", "memory"]) }),
  z.object({ kind: z.literal("opened"), conversation: conversationSchema }),
  z.object({ kind: z.literal("chunk"), requestId: idSchema, text: z.string() }),
  z.object({ kind: z.literal("done"), requestId: idSchema }),
  z.object({ kind: z.literal("failed"), requestId: idSchema, reason: z.string() }),
  z.object({ kind: z.literal("listed"), conversations: z.array(conversationSummarySchema) }),
  z.object({ kind: z.literal("error"), reason: z.string() }),
]);

/** A message from the page to the worker. */
export type Command = z.infer<typeof commandSchema>;
/** A message from the worker to the page. */
export type Notice = z.infer<typeof noticeSchema>;
/** A stored conversation: the thread's turns plus what the list needs. */
export type Conversation = z.infer<typeof conversationSchema>;
/** A conversation in the list, newest first. */
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
/** The agent the worker runs, chosen once at `init`. */
export type AgentSpec = z.infer<typeof agentSpecSchema>;
/** Where the worker keeps conversations: the browser's private file system, or memory. */
export type StorageKind = Extract<Notice, { kind: "ready" }>["storage"];
