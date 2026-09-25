import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ChatThreadPanel } from "./ChatThreadPanel";
import { threads } from "./thread";

it("renders every turn and marks embedded cards as thread-placed", () => {
  const html = renderToStaticMarkup(<ChatThreadPanel thread={threads.trend} />);
  const cards = html.match(/data-context="thread"/g) ?? [];
  expect(html.match(/class="turn turn-user"/g)).toHaveLength(2);
  expect(html.match(/class="turn turn-agent"/g)).toHaveLength(2);
  expect(cards).toHaveLength(2);
});

it("keeps the catalog boundary inside a thread: unsupported payloads never render a chart", () => {
  const html = renderToStaticMarkup(
    <ChatThreadPanel thread={threads.fallbacks} />,
  );
  expect(html).toContain("We don’t have a safe view for this yet.");
  expect(html).toContain("Showing the exact values instead.");
});

it("keeps an interactive card's work collapsed until the user asks for it", () => {
  const html = renderToStaticMarkup(<ChatThreadPanel thread={threads.profit} />);
  expect(html).toContain("Show my work");
  expect(html).toContain('aria-expanded="false"');
  expect(html).not.toContain('class="work-steps"');
});

it("floats the agent's question above the compose box with numbered choices and no close button", () => {
  const html = renderToStaticMarkup(<ChatThreadPanel thread={threads.awaiting} />);
  expect(html).toContain('aria-label="Needs you"');
  expect(html.match(/class="awaiting-key"/g)).toHaveLength(3);
  expect(html).toContain("Request a forecast view");
  expect(html).toContain('placeholder="How many weeks ahead should it forecast?"');
  expect(html).toContain("Chat about a plan to capture a different selection of sales data");
  expect(html).not.toContain("Dismiss");
});

it("never lets the recap ask for anything, even when the user has been away", () => {
  const now = Date.UTC(2026, 8, 25, 9, 16);
  const idle = { active: true, lastUserInputAt: now - 25 * 60_000 };
  const blocked = renderToStaticMarkup(
    <ChatThreadPanel thread={threads.awaiting} activity={idle} now={now} />,
  );
  expect(blocked).not.toContain('aria-label="Recap"');
  const recap = renderToStaticMarkup(
    <ChatThreadPanel thread={threads.fallbacks} activity={idle} now={now} />,
  );
  expect(recap).toContain('aria-label="Recap"');
  expect(recap).not.toContain("Needs you");
});
