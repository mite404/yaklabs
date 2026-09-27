import type { AgentEvent } from "@yaklabs/catalog/agent";
import type { ThreadMessage } from "@yaklabs/catalog/thread";

/** A thread's turns and the opening draft a dropped highlight left: what a reply rewrites. */
export type Transcript = { messages: ThreadMessage[]; draft: string; updatedAt: string };

/** When something happened: the instant for `updatedAt`, and the time of day a turn shows. */
export type Stamp = { at: string; time: string };

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

/**
 * The transcript with the user's side of `event` added and the draft spent, or unchanged when
 * the event has no user side.
 */
export function withUserTurn(transcript: Transcript, event: AgentEvent, stamp: Stamp): Transcript {
  const turn = userTurn(event, nextId(transcript.messages, "u"), stamp.time);
  if (turn === undefined) return transcript;
  return { messages: [...transcript.messages, turn], draft: "", updatedAt: stamp.at };
}

/** The transcript with the agent's finished reply added. */
export function withAgentReply(transcript: Transcript, text: string, stamp: Stamp): Transcript {
  const turn: ThreadMessage = {
    id: nextId(transcript.messages, "a"),
    role: "agent",
    text,
    time: stamp.time,
  };
  return { ...transcript, messages: [...transcript.messages, turn], updatedAt: stamp.at };
}
