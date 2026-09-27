import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ChatThreadPanel } from "./ChatThreadPanel";
import { encodeCard } from "./share";
import { ShareView } from "./ShareView";
import { profitCard, threads } from "./thread";

it("renders every turn and marks embedded cards as thread-placed", () => {
  const html = renderToStaticMarkup(<ChatThreadPanel thread={threads.trend} />);
  const cards = html.match(/data-context="thread"/g) ?? [];
  expect(html.match(/class="turn turn-user"/g)).toHaveLength(2);
  expect(html.match(/class="turn turn-agent"/g)).toHaveLength(2);
  expect(cards).toHaveLength(2);
});

it("keeps the catalog boundary inside a thread: unsupported payloads never render a chart", () => {
  const html = renderToStaticMarkup(<ChatThreadPanel thread={threads.fallbacks} />);
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
  expect(html).toContain('aria-label="Needs attention"');
  expect(html.match(/class="awaiting-key"/g)).toHaveLength(3);
  expect(html).toContain("Request a forecast view");
  expect(html).toContain('placeholder="How many weeks ahead should it forecast?"');
  expect(html).toContain("Chat about a plan to capture a different selection of sales data");
  expect(html).not.toContain("Dismiss");
});

it("waits for a choice: Submit stays disabled until a tile is selected, Skip is always there", () => {
  const html = renderToStaticMarkup(<ChatThreadPanel thread={threads.awaiting} />);
  expect(html).toMatch(
    /<button class="awaiting-action awaiting-submit" disabled="">Submit<\/button>/,
  );
  expect(html).toContain(">Skip</button>");
  expect(html).not.toContain('aria-checked="true"');
});

it("shows no card and no error when the agent's question is malformed", () => {
  const html = renderToStaticMarkup(<ChatThreadPanel thread={threads.malformed} />);
  expect(html).not.toContain('aria-label="Needs attention"');
  expect(html).not.toContain("Chat about a plan to capture");
  expect(html).not.toContain("answer.placeholder");
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
  expect(recap).not.toContain("Needs attention");
});

it("gives every card in the thread a share button, and the public page none", () => {
  const thread = renderToStaticMarkup(<ChatThreadPanel thread={threads.trend} />);
  expect(thread.match(/aria-label="Share this card"/g)).toHaveLength(2);
  const page = renderToStaticMarkup(
    <ShareView hash={"#" + encodeCard({ v: 1, kind: "interactive", payload: profitCard })} />,
  );
  expect(page).toContain("profit by day");
  expect(page).not.toContain('aria-label="Share this card"');
  expect(page).toContain("Only this view is shared, not the conversation.");
});
