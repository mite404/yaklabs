import type { AgentEvent } from "@yaklabs/catalog/agent";
import type { Thread, ThreadMessage } from "@yaklabs/catalog/thread";
import type { Conversation } from "./protocol";

// What a conversation is called until someone names it.
const UNTITLED = "New conversation";

// The time of day the way the seed threads write it: "9:02", "10:02".
function clockTime(at: Date): string {
  return `${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}`;
}

// "u" → u<n+1>, where n is the highest u-number so far; the same for "a". Seeds pair u1 with
// a1, u2 with a2, and a new turn keeps that pattern.
function nextId(messages: ThreadMessage[], prefix: "u" | "a"): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const used = messages
    .map((message) => pattern.exec(message.id)?.[1])
    .filter((digits) => digits !== undefined)
    .map(Number); // → number[]
  return `${prefix}${Math.max(0, ...used) + 1}`;
}

// The user's side of an event, or nothing: a rejected question never reached the user.
function userTurn(event: AgentEvent, id: string, time: string): ThreadMessage | undefined {
  switch (event.kind) {
    case "message": {
      const { text, attachments, files = [] } = event;
      const labels = files.map((file, i) => ({ id: `${id}-f${i + 1}`, label: file.name }));
      return {
        id,
        role: "user",
        text,
        time,
        ...(attachments.length > 0 ? { attachments } : {}),
        ...(labels.length > 0 ? { files: labels } : {}),
      };
    }
    case "answer":
      return { id, role: "user", text: event.text, time };
    case "question-rejected":
      return undefined;
    default: {
      const unhandled: never = event;
      return unhandled;
    }
  }
}

function appended(conversation: Conversation, message: ThreadMessage, at: Date): Conversation {
  return {
    ...conversation,
    messages: [...conversation.messages, message],
    updatedAt: at.toISOString(),
  };
}

/** A conversation with nothing in it yet; it is saved with its first turn. */
export function blankConversation(id: string, at: Date): Conversation {
  return { id, title: UNTITLED, messages: [], updatedAt: at.toISOString() };
}

/** The conversation a seed thread starts: its title and turns, under the page's id. */
export function fromSeed(id: string, seed: Thread, at: Date): Conversation {
  return { id, title: seed.title, messages: seed.messages, updatedAt: at.toISOString() };
}

/** The conversation with the user's side of `event` added, or unchanged when it has none. */
export function withUserTurn(
  conversation: Conversation,
  event: AgentEvent,
  at: Date,
): Conversation {
  const turn = userTurn(event, nextId(conversation.messages, "u"), clockTime(at));
  return turn === undefined ? conversation : appended(conversation, turn, at);
}

/** The conversation with the agent's finished reply added. */
export function withAgentReply(conversation: Conversation, text: string, at: Date): Conversation {
  const id = nextId(conversation.messages, "a");
  return appended(conversation, { id, role: "agent", text, time: clockTime(at) }, at);
}
