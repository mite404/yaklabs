import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { agentSchema, resolve, selectionSchema, type Selection } from "@yaklabs/catalog/catalog";
import { z } from "zod";
import type { Relay } from "./relay.ts";

/** What the MCP server needs from its host process. */
export type McpServerOptions = {
  relay: Relay;
};

// One line per component, keyed by the catalog's own enum so a new component fails typecheck.
const descriptions: Record<Selection["component"], string> = {
  LineChart:
    "A line over ordered labels such as days or weeks. variant 'trend' for change over time, " +
    "'snapshot' for one moment's series. Needs at least two non-null values, or Bonsai shows " +
    "the exact values as a DataTable instead.",
  BarChart:
    "Bars comparing values across categories. variant must be 'comparison'. Use it when the " +
    "labels are separate things rather than points in time.",
  DataTable:
    "A table of exact label and value pairs. variant must be 'audit'. Use it when the reader " +
    "needs the precise numbers, or values are missing (null).",
};

const components = selectionSchema.options.map((option) => {
  const name = option.shape.component.value; // → Selection["component"]
  return { name, description: descriptions[name] };
});

const catalog = {
  catalogVersion: "1",
  components,
  rules: [
    "Send exactly one card per insert_card call, shaped by `schema`; unknown keys are rejected.",
    "title and source are 1-120 characters; source says where the numbers came from.",
    "unit is 1-24 characters; rows hold up to 100 { label, value } pairs, value a number or null.",
    "Use only numbers the user gave you or plainly illustrative ones, and say which in source.",
  ],
  schema: agentSchema,
};

const insertResultShape = {
  threadId: z.string(),
  messageId: z.string(),
  insertionId: z.string(),
  note: z.string().optional(),
};

function failure(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

// Runs the card through the catalog's own resolve: approved cards pass, a weak trend becomes
// its fallback, an empty card keeps its empty state, anything else is refused.
function accept(card: unknown): { card: Selection; note?: string } | { error: string } {
  const resolution = resolve(card);
  switch (resolution.kind) {
    case "approved":
      return { card: resolution.selection };
    case "fallback":
      return { card: resolution.selection, note: resolution.reason };
    case "empty":
      return { card: selectionSchema.parse(card) };
    case "rejected":
      return { error: `${resolution.reason} Call list_components and send a card that fits.` };
    default: {
      const unhandled: never = resolution;
      return unhandled;
    }
  }
}

function joinNotes(...notes: (string | undefined)[]): string | undefined {
  const kept = [...new Set(notes.filter((note) => note !== undefined && note !== ""))];
  return kept.length === 0 ? undefined : kept.join(" ");
}

/** Builds the Bonsai MCP server: list_components for discovery, insert_card through the relay. */
export function createMcpServer({ relay }: McpServerOptions): McpServer {
  const server = new McpServer({ name: "bonsai", version: "0.1.0" });

  server.registerTool(
    "list_components",
    {
      title: "List Bonsai catalog components",
      description:
        "List the catalog components a card can use, with the JSON Schema a card must match. " +
        "Call this before insert_card. Works without a connected browser.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () => ({
      content: [{ type: "text", text: JSON.stringify(catalog) }],
      structuredContent: catalog,
    }),
  );

  server.registerTool(
    "insert_card",
    {
      title: "Insert a card into a Bonsai thread",
      description:
        "Insert one validated catalog card into the Bonsai thread the user connected. The user " +
        "gives you the connection code shown in Bonsai. Make a fresh random UUID for " +
        "insertionId per card and reuse it when retrying that same card, so Bonsai never " +
        "shows it twice. Succeeds only once Bonsai has saved the card.",
      inputSchema: {
        connectionCode: z.uuid().describe("The connection code Bonsai shows the user."),
        insertionId: z
          .uuid()
          .describe("A fresh random UUID for this card; reuse it to retry the same card."),
        card: selectionSchema.describe("One card matching the list_components schema."),
      },
      outputSchema: insertResultShape,
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ connectionCode, insertionId, card }, extra): Promise<CallToolResult> => {
      const accepted = accept(card);
      if ("error" in accepted) return failure(accepted.error);
      const outcome = await relay.insert(connectionCode, insertionId, accepted.card, extra.signal);
      if (!outcome.ok) return failure(outcome.error);
      const note = joinNotes(accepted.note, outcome.note);
      const result = {
        threadId: outcome.threadId,
        messageId: outcome.messageId,
        insertionId: outcome.insertionId,
        ...(note === undefined ? {} : { note }),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  return server;
}
