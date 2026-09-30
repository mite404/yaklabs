import type { AgentEvent } from "./agent";
import type { ThreadMessage } from "./thread";

/** A user turn that answered a docked question (ADR-039). */
export type AnsweredMessage = Extract<ThreadMessage, { role: "user" }> & { question: string };

/**
 * One item of a thread as it is drawn: a turn on its own, or a run of consecutive answers to
 * docked questions, which the thread shows together on one surface, question over answer.
 */
export type TranscriptItem =
  | { kind: "turn"; message: ThreadMessage }
  | { kind: "answers"; id: string; messages: AnsweredMessage[] };

function isAnswer(message: ThreadMessage): message is AnsweredMessage {
  return message.role === "user" && message.question !== undefined;
}

/**
 * The thread's turns as they are drawn: every turn in order, with each run of consecutive
 * answers merged into one item, keyed by its first answer so it keeps its place as it grows.
 */
export function groupAnswers(messages: ThreadMessage[]): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  for (const message of messages) {
    const last = items.at(-1);
    if (!isAnswer(message)) items.push({ kind: "turn", message });
    else if (last?.kind === "answers") last.messages.push(message);
    else items.push({ kind: "answers", id: `answers-${message.id}`, messages: [message] });
  }
  return items;
}

// The last of `items` that passes `test`, searched from the end.
function findLast<T>(items: T[], test: (item: T) => boolean): T | undefined {
  for (let i = items.length - 1; i >= 0; i--) if (test(items[i])) return items[i];
  return undefined;
}

/**
 * What the agent was told for the reply `turnId`, read back from the thread: the user turn just
 * before it, as a message or as the answer to a question. For a reply the panel did not send
 * itself, such as one in a thread it opened with; undefined when no user turn comes before it.
 */
export function requestBefore(messages: ThreadMessage[], turnId: string): AgentEvent | undefined {
  const at = messages.findIndex((message) => message.id === turnId);
  const asked = findLast(messages.slice(0, Math.max(at, 0)), (message) => message.role === "user");
  if (asked?.role !== "user") return undefined;
  if (asked.question !== undefined) return { kind: "answer", text: asked.text };
  return { kind: "message", text: asked.text, attachments: asked.attachments ?? [] };
}

/** The id of the latest agent turn that stopped short (interrupted, failed or cancelled). */
export function latestEnded(messages: ThreadMessage[]): string | undefined {
  return findLast(messages, (message) => message.role === "agent" && message.ended !== undefined)
    ?.id;
}

/**
 * What the latest reply still streaming is doing: its narration, "Working" when it has said
 * none, or undefined when no reply streams.
 */
export function runningActivity(messages: ThreadMessage[]): string | undefined {
  const running = findLast(
    messages,
    (message) => message.role === "agent" && message.streaming === true,
  );
  if (running?.role !== "agent") return undefined;
  return running.activity ?? "Working";
}
