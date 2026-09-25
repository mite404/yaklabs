import type { CardAttachment } from "./interactive";

/**
 * What the thread tells the agent (ADR-041). The UI only ever reports events; deciding what
 * to say back is the agent runtime's job, whether that is the lab stand-in or a real model.
 */
export type AgentEvent =
  /** The user sent a message, with any card choices riding along (ADR-030). */
  | { kind: "message"; text: string; attachments: CardAttachment[] }
  /** The user answered the agent's "Needs you" question (ADR-039). */
  | { kind: "answer"; text: string }
  /** The agent's question failed the schema, so it was never shown (ADR-040). The user never
   *  sees `reason`; the agent uses it to ask again in plain words. */
  | { kind: "question-rejected"; reason: string; question: unknown };

/**
 * The seam between the thread and whatever produces replies (ADR-041). A reply streams in as
 * text chunks, the way a model streams tokens; an agent may also yield nothing at all.
 * Swap the lab stand-in for a real model by passing another `Agent` to the thread panel.
 */
export type Agent = {
  respond(event: AgentEvent, signal: AbortSignal): AsyncIterable<string>;
};
