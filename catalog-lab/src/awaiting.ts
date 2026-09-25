import { z } from "zod";

const text = z.string().trim().min(1).max(160);

/**
 * A question the agent is blocked on (ADR-039). The agent supplies the question, the branches
 * it can take, and one concrete question the user can answer by typing. The last row is always
 * a way out: the agent may word it for the moment ("Chat about a plan to ..."), and the host
 * falls back to "Chat about something else", so the user can never be cornered into answering.
 * Each row asks something different, so the card never asks "what do you want?" twice.
 */
export const awaitingSchema = z.strictObject({
  question: text,
  options: z
    .array(
      z.strictObject({
        label: z.string().trim().min(1).max(60),
        detail: text.optional(),
      }),
    )
    .min(1)
    .max(4),
  answer: z.strictObject({ placeholder: z.string().trim().min(1).max(60) }),
  elsewhere: z.string().trim().min(1).max(80).optional(),
});

/** A validated question the agent is waiting on. */
export type AwaitingInput = z.infer<typeof awaitingSchema>;

/** Validates an agent's question; anything malformed is dropped rather than half-shown. */
export function resolveAwaiting(payload: unknown): AwaitingInput | undefined {
  const parsed = awaitingSchema.safeParse(payload);
  return parsed.success ? parsed.data : undefined;
}
