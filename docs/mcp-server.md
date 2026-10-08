# Demo Bonsai cards from Claude Desktop

Use Claude Desktop on your own computer beside the local Bonsai app. Claude chooses a catalog
component and supplies its data. Bonsai validates and saves the card in the thread you connected.
No message is sent through Bonsai's compose box, and no separate renderer is needed.

This is a local interview demo, not a deployed integration. It revisits ADR-137's catalog-MCP cut
only for this workflow. Production sign-in, the gateway, and the scripted Demo stay unchanged.
See [the implementation tasks](mcp-server-tasks.md) for scope and acceptance checks.

## Prepare your computer

1. Install Node.js 22.18 or newer and pnpm 10.33.0.
2. Check out `feat/mcp-server` on your computer.
3. Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @yaklabs/mcp-server build
```

4. Start Bonsai with local sign-in and the lab agent. On macOS, run:

```sh
VITE_AUTH=none VITE_AGENT=lab pnpm --filter web dev --port 5173 --strictPort
```

On Windows PowerShell, run:

```powershell
$env:VITE_AUTH="none"
$env:VITE_AGENT="lab"
pnpm --filter web dev --port 5173 --strictPort
```

5. Open the local app at `http://localhost:5173/t/playground` on that same computer.
   Do not use the deployed site, an orb preview, or a `?scenario=` URL for this rehearsal.

## Connect Claude Desktop

1. Open **Settings > Developer > Edit Config** in Claude Desktop.
2. Add `bonsai` to the existing `mcpServers` object. Preserve your other servers.
   Replace both paths below with absolute paths on your computer:

```json
{
  "mcpServers": {
    "bonsai": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/yaklabs/tools/mcp-server/dist/index.js"],
      "env": {
        "BONSAI_ORIGIN": "http://localhost:5173",
        "BONSAI_MCP_PORT": "4318"
      }
    }
  }
}
```

On macOS, locate Node with `which node`. On Windows, use `(Get-Command node).Source`.
Use escaped backslashes or forward slashes in Windows JSON paths.

3. Quit Claude Desktop completely, then reopen it.
4. Confirm that Bonsai exposes `list_components` and `insert_card` in Claude's available tools.
5. In Bonsai's Live Playground, click **Connect external agent**, then **Allow card insertion**.
6. Click **Copy prompt for Claude**, then close the dialog. Leave Bonsai's compose box empty.

The connection code grants card insertion into this one thread. Share it only with your chosen
agent. The code expires after 15 minutes and stops working after disconnect or loss of polling.
The integration does not give Claude a tool for reading transcripts or choosing another thread.

Follow the [MCP setup guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers)
if your Claude Desktop menus differ.

## Rehearse the interview

1. Arrange Claude Desktop and Bonsai side by side.
2. Paste the copied connection prompt into Claude, then add:

> First call list_components. Choose the appropriate card for these production costs:
> Camera $3,200, Lighting $1,850, Sound $940. Title it "Production budget" and identify
> the source as "Figures supplied for this demo". Insert it into my connected Bonsai thread.
> Generate a fresh UUID for insertionId. Do not invent additional figures.

3. Approve Claude's tool call if prompted.
4. Show the resulting card in Bonsai, marked **External · via MCP**.
5. Point out that Bonsai's compose box is empty and no user message was added.
6. Reload Bonsai to show that the card and its attribution survive.
7. Reconnect for a new code after reload. Ask Claude to retry the same card with the same
   `insertionId` to show that the card is not duplicated.
8. Disconnect in Bonsai, then ask Claude to insert another card. Show the tool's refusal.

An empty compose box alone does not prove an external agent caused the change. Show Claude's
actual tool call and its saved message ID alongside the corresponding Bonsai card. The label
records the MCP path, not a verified identity for a particular model or desktop application.

## Run the automated rehearsal

With the local app running and Claude Desktop fully quit, run:

```sh
pnpm --filter @yaklabs/mcp-server test
pnpm --filter @yaklabs/mcp-server exec playwright install chromium
node tools/mcp-server/scripts/browser-check.mjs
```

The browser check launches a real stdio MCP client and the built server. It checks rendering,
an empty compose box, no synthetic user message, persistence, duplicate prevention, draft
preservation, invalid cards, and revocation. It saves screenshots under `.artifacts/mcp`.
Do not run it beside Claude's Bonsai server: both need relay port 4318.

The automated check does not run Claude Desktop or test a model's component-selection behavior.
Complete the desktop rehearsal on your computer before the interview.

## Resolve connection failures

- If Claude cannot launch Bonsai, check both absolute paths and rebuild the server.
- If port 4318 is occupied, quit the other Bonsai server. To change the port, set
  `BONSAI_MCP_PORT` to the same value for both Vite and Claude's server, then restart both.
- If the app says the local connection is unavailable, confirm that Claude launched the server.
  `BONSAI_ORIGIN` must match your browser's origin exactly, including its port.
- If the connection expires, connect again and give Claude the new code.
- If the thread is replying, wait for the reply to finish, then retry.
- If delivery is reported as unknown, retry with the same insertion ID and identical card.
  Disconnect cannot undo a save that already started.

ChatGPT desktop support is not included or verified here. Use Claude Desktop's documented local
stdio integration rather than adding remote hosting and authentication solely for the demo.
