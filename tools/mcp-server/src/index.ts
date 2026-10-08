import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { startRelayHttp } from "./http.ts";
import { createMcpServer } from "./mcp.ts";
import { createRelay } from "./relay.ts";

const configSchema = z.object({
  BONSAI_MCP_PORT: z.coerce.number().int().min(1).max(65535).default(4318),
  BONSAI_ORIGIN: z.url().default("http://localhost:5173"),
});

async function main(): Promise<void> {
  const config = configSchema.parse(process.env);
  const relay = createRelay();
  const http = await startRelayHttp({
    relay,
    port: config.BONSAI_MCP_PORT,
    origin: new URL(config.BONSAI_ORIGIN).origin,
  });
  const server = createMcpServer({ relay });
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    relay.close();
    await http.close();
    await server.close();
  };
  // oxlint-disable-next-line unicorn/prefer-add-event-listener -- the MCP SDK exposes a callback, not EventTarget
  server.server.onclose = () => {
    void stop();
  };
  process.once("SIGINT", () => {
    void stop();
  });
  process.once("SIGTERM", () => {
    void stop();
  });
  await server.connect(new StdioServerTransport());
  process.stderr.write(`Bonsai MCP ready; browser relay on 127.0.0.1:${http.port}\n`);
}

try {
  await main();
} catch (error: unknown) {
  process.stderr.write(`Bonsai MCP could not start: ${String(error)}\n`);
  process.exitCode = 1;
}
