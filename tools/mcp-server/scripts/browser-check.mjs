// Exercise the real stdio MCP entrypoint and a real Bonsai browser. No app hooks or mocks.
// oxlint-disable no-console, no-await-in-loop -- a verification lever reports ordered checks
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { chromium } from "playwright";

const {
  values: { base, out },
} = parseArgs({
  options: {
    base: { type: "string", default: "http://localhost:5173" },
    out: {
      type: "string",
      default: fileURLToPath(new URL("../../../.artifacts/mcp", import.meta.url)),
    },
  },
});
mkdirSync(out, { recursive: true });
const client = new Client({ name: "external-browser-check", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
  env: { ...process.env, BONSAI_ORIGIN: new URL(base).origin },
  stderr: "inherit",
});
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
/** @type {string[]} */
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() !== "error") return;
  errors.push(message.text());
});
const card = {
  catalogVersion: "1",
  component: "BarChart",
  props: {
    title: "Production budget",
    source: "Interviewer's supplied figures",
    unit: "USD",
    variant: "comparison",
    rows: [
      { label: "Camera", value: 3200 },
      { label: "Lighting", value: 1850 },
      { label: "Sound", value: 940 },
    ],
  },
};
try {
  await client.connect(transport);
  assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name).toSorted(), [
    "insert_card",
    "list_components",
  ]);
  await page.goto(`${base}/t/playground`);
  const compose = page.getByRole("textbox", { name: "Message", exact: true });
  await compose.waitFor();
  assert.equal(await compose.inputValue(), "");
  await page
    .getByRole("button", { name: "Connect external agent", exact: true })
    .click({ timeout: 10000 });
  await page.getByRole("button", { name: "Allow card insertion", exact: true }).click();
  const code = await page.getByRole("textbox", { name: "Connection code" }).inputValue();
  assert.match(code, /^[0-9a-f-]{36}$/);
  await page.screenshot({
    path: path.join(out, "connection-dialog.png"),
    mask: [page.getByRole("textbox", { name: "Connection code" })],
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const insertionId = randomUUID();
  const args = { connectionCode: code, insertionId, card };
  const result = CallToolResultSchema.parse(
    await client.callTool({ name: "insert_card", arguments: args }),
  );
  assert.ok(!result.isError, JSON.stringify(result));
  assert.deepEqual(result.structuredContent, {
    threadId: "playground",
    messageId: `mcp:${insertionId}`,
    insertionId,
  });
  const external = page.getByRole("article", { name: "External agent via MCP" });
  await external.waitFor();
  assert.equal(await external.count(), 1);
  assert.match(await external.innerText(), /Production budget/);
  assert.match(await external.innerText(), /Camera/);
  assert.equal(await compose.inputValue(), "");
  assert.equal(await page.locator(".turn-user").count(), 0);
  console.log(
    "PASS real stdio call renders card, empty compose, no user message, matching saved ID",
  );
  await page.screenshot({ path: path.join(out, "external-card.png") });
  await compose.fill("Keep this unsent draft");
  const retry = CallToolResultSchema.parse(
    await client.callTool({ name: "insert_card", arguments: args }),
  );
  assert.ok(!retry.isError);
  assert.equal(await external.count(), 1);
  assert.equal(await compose.inputValue(), "Keep this unsent draft");
  console.log("PASS retry does not duplicate or clear an unsent draft");
  const bad = await client.callTool({
    name: "insert_card",
    arguments: { ...args, insertionId: randomUUID(), card: { ...card, component: "PieChart" } },
  });
  assert.equal(bad.isError, true);
  assert.equal(await external.count(), 1);
  console.log("PASS unsupported component rejected without rendering");
  await compose.fill("");
  await page.getByRole("button", { name: "External agent connected", exact: true }).click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  const revoked = await client.callTool({
    name: "insert_card",
    arguments: { ...args, insertionId: randomUUID() },
  });
  assert.equal(revoked.isError, true);
  console.log("PASS disconnect revokes external writes");
  await page.reload();
  await external.waitFor();
  assert.equal(await external.count(), 1);
  assert.match(await external.innerText(), /Production budget/);
  assert.equal(await compose.inputValue(), "");
  console.log("PASS reload preserves card and MCP attribution");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(out, "external-card-mobile.png") });
  assert.deepEqual(errors, []);
  console.log("PASS browser console has no errors");
} finally {
  await browser.close();
  await client.close();
}
