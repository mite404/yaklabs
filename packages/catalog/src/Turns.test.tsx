import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { scenarios } from "./fixtures";
import type { AgentMessage } from "./reply";
import { AgentTurn } from "./Turns";

const reply: AgentMessage = {
  id: "a1",
  role: "agent",
  text: "Closed cases by team",
  time: "9:02",
  payload: scenarios.comparison.payload,
};

const render = (message: AgentMessage) =>
  renderToStaticMarkup(<AgentTurn message={message} onChoose={() => {}} cardsCarry={false} />);

it("says a card an external agent inserted came in over MCP", () => {
  const external = { insertionId: "0b6f4f1e-3c1a-4d2e-9f3b-6a1c2d3e4f50" };
  const html = render({ ...reply, id: `mcp:${external.insertionId}`, external });
  expect(html).toContain('aria-label="External agent via MCP"');
  expect(html).toContain('<span class="turn-stamp" aria-hidden="true">External · via MCP</span>');
});

it("labels the thread's own agent plainly", () => {
  const html = render(reply);
  expect(html).toContain('aria-label="Agent"');
  expect(html).not.toContain("via MCP");
});
