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
