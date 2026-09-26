import { z } from "zod";

// What the browser's worker may send the model through the gateway (ADR-085): plain text
// turns only. The gateway owns the model, the key and every other request setting.
const textBlockSchema = z.object({ type: z.literal("text"), text: z.string().min(1) });
const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.union([z.string().min(1), z.array(textBlockSchema).min(1).max(20)]),
});

/** The body of `POST /api/messages`; anything else is rejected before the model sees it. */
export const gatewayRequestSchema = z.object({
  system: z.string().max(20_000),
  messages: z.array(turnSchema).min(1).max(200),
});

/** A validated gateway request. */
export type GatewayRequest = z.infer<typeof gatewayRequestSchema>;
