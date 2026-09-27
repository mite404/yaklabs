import type { AgentEvent } from "@yaklabs/catalog/agent";
import type { CardAttachment } from "@yaklabs/catalog/interactive";
import type { ThreadMessage } from "@yaklabs/catalog/thread";
import type { GatewayRequest } from "gateway/contract";
import type { Conversation } from "./protocol";

type Turn = GatewayRequest["messages"][number];

// The gateway takes at most 200 turns (gatewayRequestSchema); the oldest go first.
const MAX_TURNS = 200;

// What the model must know to answer inside the thread. The card-view line is the whole point
// of the slice: the user's choice on an interactive card rides along with the next message
// (ADR-030, ADR-031), and the reply has to speak to the view they set.
const SYSTEM_PROMPT = [
  "You are Kay's assistant, replying to the user inside a chat thread.",
  "You can only show data through catalog cards that are already in the thread: you cannot " +
    "draw a new chart, and you never invent a number. Each card you showed appears in your " +
    "earlier turn as JSON in a fenced block; read figures from there.",
  "Some cards are interactive: the user steps a control through views, such as gross, " +
    "operating and net profit.",
  "Lines in square brackets are added by the app, not typed by the user. When the user has " +
    "changed a card's view, their message arrives with a line [Card view: <label>] naming the " +
    "view they set; answer about that view, with its numbers. A line [Attached file: <name>] " +
    "names a file they attached; you cannot see inside it.",
  "Keep replies short and plain: a few sentences, no headings, no tables.",
].join("\n\n");

const cardViewLine = (attachment: CardAttachment) => `[Card view: ${attachment.label}]`;
const fileLine = (name: string) => `[Attached file: ${name}]`;
const fenced = (json: string) => `\`\`\`json\n${json}\n\`\`\``;

// Non-empty lines, one per line: the text, then whatever rode along with it.
function joinLines(lines: string[]): string {
  return lines.filter((line) => line.trim() !== "").join("\n");
}

function userContent(text: string, attachments: CardAttachment[], fileNames: string[]): string {
  const views = attachments.map((attachment) => cardViewLine(attachment)); // → string[]
  const files = fileNames.map((name) => fileLine(name)); // → string[]
  return joinLines([text, ...views, ...files]);
}

// A card the agent showed, as compact JSON, so the model knows what is on screen.
function cardBlocks(message: Extract<ThreadMessage, { role: "agent" }>): string[] {
  return [message.interactive, message.payload]
    .filter((card) => card !== undefined)
    .map((card) => fenced(JSON.stringify(card)));
}

function toTurn(message: ThreadMessage): Turn {
  switch (message.role) {
    case "user": {
      const fileNames = (message.files ?? []).map((file) => file.label); // → string[]
      const content = userContent(message.text, message.attachments ?? [], fileNames);
      return { role: "user", content };
    }
    case "agent":
      return { role: "assistant", content: joinLines([message.text, ...cardBlocks(message)]) };
    default: {
      const unhandled: never = message;
      return unhandled;
    }
  }
}

// ADR-040: the user never sees a malformed question; the agent learns why and asks in words.
function askAgainContent(event: Extract<AgentEvent, { kind: "question-rejected" }>): string {
  const question = event.question === undefined ? [] : [fenced(JSON.stringify(event.question))];
  return joinLines([
    "[Question not shown] Your last question to the user failed the question check, so it " +
      "was never shown and the user has not seen it.",
    `Why it failed: ${event.reason}`,
    "Ask again in plain words, in a short ordinary reply.",
    ...question,
  ]);
}

function eventContent(event: AgentEvent): string {
  switch (event.kind) {
    case "message": {
      const fileNames = (event.files ?? []).map((file) => file.name); // → string[]
      return userContent(event.text, event.attachments, fileNames);
    }
    case "answer":
      return event.text;
    case "question-rejected":
      return askAgainContent(event);
    default: {
      const unhandled: never = event;
      return unhandled;
    }
  }
}

// The newest turns that fit, starting at a user turn, since the API wants the user first.
function recentTurns(history: Turn[]): Turn[] {
  const recent = history.slice(-(MAX_TURNS - 1)); // → Turn[]
  const firstUser = recent.findIndex((turn) => turn.role === "user");
  return firstUser === -1 ? [] : recent.slice(firstUser);
}

/**
 * Builds what the gateway sends the model (ADR-085): the system prompt, every stored turn in
 * order, then the incoming event as the last user turn. `conversation` is the thread as it
 * stood before the event. A user turn carries one `[Card view: …]` line per card choice and one
 * `[Attached file: …]` line per file; an agent turn carries the cards it showed as JSON.
 *
 * @throws When the event carries nothing to answer: no text, card choice or file.
 */
export function toModelRequest(conversation: Conversation, event: AgentEvent): GatewayRequest {
  const history = conversation.messages
    .map((message) => toTurn(message))
    .filter((turn) => turn.content !== ""); // → Turn[]
  const content = eventContent(event);
  if (content === "") throw new Error("The message is empty, so there is nothing to answer");
  return { system: SYSTEM_PROMPT, messages: [...recentTurns(history), { role: "user", content }] };
}
