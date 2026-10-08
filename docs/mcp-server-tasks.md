# MCP server implementation tasks

Goal: an external agent discovers Bonsai's existing catalog, supplies a valid card, and causes
that card to appear in a connected live thread without sending through Bonsai's compose box.

## 1. Expose the catalog through MCP

- Add a bundled Node stdio server using the official MCP SDK.
- Expose `list_components` from the existing catalog schema and descriptions.
- Expose `insert_card` with a connection code, insertion UUID, and validated card.
- Keep component names, variants, and rendering rules owned by the catalog.

Acceptance: a real MCP client discovers both tools; unsupported components are refused.

## 2. Connect one browser thread

- Add a loopback relay and a development-only same-origin Vite proxy.
- Require explicit consent in the live thread and issue a short-lived connection code.
- Use separate credentials for browser polling and agent insertion.
- Bind each connection to one thread. Bound sessions, request sizes, and acknowledgement time.
- Revoke access on disconnect, expiry, or loss of polling.

Acceptance: foreign origins and hosts, wrong credentials, expired codes, and disconnected
sessions cannot insert cards. No transcript-reading tool is exposed.

## 3. Save and render external cards

- Add a checked worker command using the existing SQLite transcript store.
- Assign a stable message ID from the insertion UUID and record MCP attribution internally.
- Refuse scripted scenarios, missing threads, active replies, and conflicting retries.
- Append the saved turn to the mounted thread panel without remounting or clearing its draft.
- Acknowledge success to the MCP caller only after the save completes.

Acceptance: the card renders with **External · via MCP**, survives reload, leaves compose
untouched, and is not duplicated by an identical retry.

## 4. Verify and document the desktop demo

- Test relay permissions, validation, cancellation, acknowledgement, and retry behavior.
- Test persistence and thread-panel receipt through their public interfaces.
- Run a real stdio-to-browser rehearsal with asymmetric chart data and inspect desktop and
  narrow-screen captures.
- Document Claude Desktop setup, consent, the interview prompt, and failure recovery.
- Rehearse on the presenter's own computer with Claude Desktop before the interview.

Acceptance: the recruiter can watch a prompt and tool call in Claude Desktop produce a saved
card in Bonsai, with Bonsai's compose empty. SDK automation verifies the server path but does
not substitute for this final desktop rehearsal.

## Deliberately excluded

Remote MCP hosting, production auth changes, screenshot delivery to the agent, a second preview
app, transcript export, arbitrary HTML, and a LangGraph orchestrator are not needed for this demo.
