import type { PlaygroundEvent } from "@yaklabs/catalog/playground";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentReply, type ReplyActions } from "./Reply";
import type { AgentTurn } from "./state";
import { streamed } from "./test-fixtures";

const actions: ReplyActions = { onSend: () => {}, onRetry: () => {}, locked: false };

const failure = {
  type: "failure",
  seq: 1,
  workId: null,
  limitation: "The model stopped responding.",
  recovery: null,
} as const;

// The reply the page shows after `events`, as markup.
function shown(events: PlaygroundEvent[]): string {
  const turn: AgentTurn | undefined = streamed(events).exchanges.at(0)?.agent;
  if (turn === undefined) throw new Error("No exchange was sent.");
  return renderToStaticMarkup(createElement(AgentReply, { turn, actions }));
}

describe("AgentReply", () => {
  it("offers Try again when the gateway ended the reply at a failure", () => {
    const start = { type: "start", seq: 0, v: 1 } as const;
    for (const reason of ["upstream", "limit"] as const) {
      const html = shown([start, failure, { type: "end", seq: 2, reason }]);
      expect(html).toContain("The model stopped responding.");
      expect(html).toContain("Try again");
    }
    expect(shown([start, failure, { type: "end", seq: 2, reason: "answered" }])).not.toContain(
      "Try again",
    );
  });

  it("shows the working glyph while the model reasons before any event", () => {
    const html = shown([{ type: "start", seq: 0, v: 1 }]);
    expect(html).toContain("agent-tree");
    expect(html).toContain("Thinking…");
  });

  it("puts Try again inside the failure section it recovers from", () => {
    const start = { type: "start", seq: 0, v: 1 } as const;
    const html = shown([start, failure, { type: "end", seq: 2, reason: "upstream" }]);
    expect(html).toMatch(/aria-label="Limitation"(?:(?!<\/section>).)*Try again/s);
  });
});
