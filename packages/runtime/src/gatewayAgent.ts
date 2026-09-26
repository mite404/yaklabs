import { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";
import type { Agent, AgentEvent } from "@yaklabs/catalog/agent";
import type { AppType } from "gateway/app";
import { hc } from "hono/client";
import { toModelRequest } from "./modelRequest";
import type { Conversation } from "./protocol";
import type { ConversationStore } from "./store";
import { untilAborted } from "./untilAborted";

// What the gateway agent needs: where the gateway is, who is asking, and which thread.
type GatewayAgentOptions = {
  baseUrl: string;
  // The signed-in user's WorkOS token; without one the gateway refuses (ADR-084, ADR-085).
  accessToken?: string;
  store: ConversationStore;
  conversationId: string;
  // Replaces the network, for tests that route requests to an in-process app.
  fetch?: typeof fetch;
};

// The worker saves the user's turn before the agent runs, so the turn survives a failed reply.
// The request carries that turn as the event itself, so it leaves the history here.
function historyBefore(conversation: Conversation, event: AgentEvent): Conversation {
  const savedTurn =
    event.kind !== "question-rejected" && conversation.messages.at(-1)?.role === "user";
  return savedTurn
    ? { ...conversation, messages: conversation.messages.slice(0, -1) }
    : conversation;
}

// The reply's text as it streams, the way the SDK's `text` event reports it.
async function* textDeltas(stream: MessageStream, signal: AbortSignal): AsyncGenerator<string> {
  for await (const event of untilAborted(stream, signal)) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

/**
 * The agent behind the gateway (ADR-076, ADR-085): it reads the conversation from the store,
 * sends it through the gateway with the user's card choices in the last turn, and yields the
 * model's reply as it streams. Aborting the signal ends the reply quietly.
 *
 * @throws From `respond`: when the conversation is unknown, when the event is empty, when the
 *   gateway answers anything but 200 (the message names the status, never the body), or when
 *   the stream breaks.
 */
export function createGatewayAgent(options: GatewayAgentOptions): Agent {
  const { baseUrl, accessToken, store, conversationId, fetch } = options;
  const headers: Record<string, string> =
    accessToken === undefined ? {} : { Authorization: `Bearer ${accessToken}` };
  const client = hc<AppType>(baseUrl, { fetch, headers });

  return {
    async *respond(event, signal) {
      const conversation = await store.open(conversationId); // → Conversation | undefined
      if (conversation === undefined) throw new Error(`No conversation ${conversationId}`);
      const request = toModelRequest(historyBefore(conversation, event), event); // → GatewayRequest
      try {
        // Typed as a plain Response: the reply is a stream, not the route's JSON.
        const response: Response = await client.api.messages.$post(
          { json: request },
          { init: { signal } },
        );
        if (response.status !== 200) {
          await response.body?.cancel(); // the body may hold details the page must not show
          throw new Error(`The gateway replied ${response.status}`);
        }
        if (response.body === null) throw new Error("The gateway replied without a body");
        const stream = MessageStream.fromReadableStream(response.body); // → MessageStream
        try {
          yield* textDeltas(stream, signal);
        } finally {
          stream.abort();
        }
      } catch (error) {
        if (!signal.aborted) throw error;
      }
    },
  };
}
