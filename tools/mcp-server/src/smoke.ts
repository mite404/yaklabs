import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

// Uses the same stdio entrypoint as Claude Desktop. No browser internals are called.
const client = new Client({ name: "bonsai-smoke", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL("./index.js", import.meta.url))],
  stderr: "inherit",
});

try {
  await client.connect(transport);
  const [code, inputFile, insertionId = randomUUID()] = process.argv.slice(2);
  const result =
    code === undefined
      ? await client.callTool({ name: "list_components", arguments: {} })
      : await client.callTool({
          name: "insert_card",
          arguments: {
            connectionCode: code,
            insertionId,
            card: JSON.parse(await readFile(inputFile ?? "", "utf8")),
          },
        });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (CallToolResultSchema.parse(result).isError === true) process.exitCode = 1;
} finally {
  await client.close();
}
