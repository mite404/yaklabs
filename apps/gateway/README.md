# gateway

The slice's only server (ADR-085): one Cloudflare Worker that serves the static React Router
build and a small Hono API under `/api` from the same origin, so there is one deploy, no CORS and
one allowed origin in WorkOS (ADR-086).

## What it does

- `GET /api/health` answers `{ "ok": true }`.
- `POST /api/messages` takes `{ system, messages }` (`src/contract.ts`) and:
  - answers 401 `{ "error": "unauthorized" }` unless `Authorization: Bearer <token>` carries a
    WorkOS AuthKit access token that verifies against WorkOS's public keys (`src/auth.ts`);
  - answers 400 `{ "error": "invalid request" }` when the body does not match the schema; any
    other field, such as `model`, is dropped;
  - streams the reply from `moonshotai/kimi-k2.6` through OpenRouter's Anthropic-compatible
    Messages API (`src/upstream.ts`, ADR-146; `max_tokens` 8192 as a cost cap, reasoning
    included) as `application/x-ndjson`: one Messages API stream event per line, exactly as the
    SDK's `MessageStream.toReadableStream()` writes it. The browser reads it back with
    `MessageStream.fromReadableStream(response.body)`;
  - answers 502 `{ "error": "upstream", "status": <number | null> }` when OpenRouter refuses the
    request, without the upstream body or the key.
- `POST /api/playground` takes the playground's history (`playgroundRequestSchema` in
  `@yaklabs/catalog/playground`), behind the same token check, and runs the tool loop for
  `/playground` (ADR-155):
  - the prompt and the tool loop live here, never in the browser (`src/playground.ts`); the
    five tool definitions are shared schema from `@yaklabs/catalog/playground`;
  - each round's tool calls are checked with the catalog's own validators; a bad call goes back
    to the model as an error result and never reaches the page (`src/playgroundTools.ts`). A
    tool whose input fails twice is retired for the rest of the turn: the next round no longer
    offers it, and a call to it anyway is refused flat (ADR-157);
  - the reply streams as `application/x-ndjson`, one `PlaygroundEvent` per line, from `start`
    to `end`, with `seq` counting up without a gap;
  - text is prose from its first delta and is never relabelled; progress reaches the page only
    as `update_work` labels, and a turn that stops at a limit or loses the model says why in
    `end`'s `line` (protocol 2);
  - a turn stops at 8 rounds; tool calls past 16 in a turn get an error result instead of
    running, and a refused first round answers 502 like `/api/messages`.
- Every other path is a static file from `apps/web/build/client`; a path that is not a file gets
  `index.html`, and the app's router takes it from there. The Worker runs only for `/api/*`.
- It stores nothing and logs no conversation content.

The code: `src/worker.ts` is the Workers entry, which reads the bindings and builds the app once
per isolate; `src/app.ts` is the route table (`AppType`, for Hono's typed client); `src/auth.ts`
verifies tokens.

## Local development

```sh
cp apps/gateway/.dev.vars.example apps/gateway/.dev.vars   # then fill in both values
pnpm --filter web build                                    # the static site the Worker serves
pnpm --filter gateway dev                                  # http://localhost:8787
```

`wrangler dev` serves the last web build, so rebuild the web app to see UI changes there.
`.dev.vars` is ignored by git and supplies both bindings locally.

```sh
pnpm --filter gateway test        # vitest in node: routes, streaming, auth
pnpm --filter gateway typecheck
pnpm --filter gateway build       # wrangler deploy --dry-run into dist/, deploys nothing
```

The build bundles the web build as the Worker's assets, so `apps/web/build/client` must exist:
run `pnpm --filter web build` first. The root `pnpm build` orders the two through Turbo.

## Secrets and variables

| Binding              | Production                                           | Local       |
| -------------------- | ---------------------------------------------------- | ----------- |
| `OPENROUTER_API_KEY` | secret: `wrangler secret put`, or a dashboard Secret | `.dev.vars` |
| `WORKOS_CLIENT_ID`   | variable: a dashboard Text variable                  | `.dev.vars` |

The OpenRouter key's own credit limit is the slice's spending cap (ADR-146): OpenRouter refuses
the key once it is spent, and the gateway answers 502 with that status.

Nothing environment-specific is written in `wrangler.jsonc`: `keep_vars` is on, so a deploy keeps
the dashboard's variables (a value named under `vars` would replace them), and secrets survive
deploys anyway. Until both values are set, every `/api/*` request fails with a 500 while the
static site keeps working, and the Worker's logs name each missing or malformed binding (never
its value); the client id must start with `client_`.

Token checks accept the issuers WorkOS's hosted API mints: `https://api.workos.com` for older
environments and `https://api.workos.com/user_management/<clientId>` for ones created since
mid-2025. A custom auth domain mints its own issuer, which `src/auth.ts` would need to accept.

## Logs

`observability` is on in `wrangler.jsonc`, so Cloudflare keeps an invocation log per request
(method, URL, response status, timing) beside the Worker's own console records. The new failure
records reach production after deployment; `wrangler dev` prints console records locally.

- Stored logs: Cloudflare dashboard, Workers & Pages, `yaklabs`, Observability, Events. Filter
  by `event` to find the gateway's records. Invocations shows the requests themselves.
- Live logs: `pnpm --filter gateway exec wrangler tail` streams the deployed Worker's requests
  and records as they happen. The gateway answers its own failures, so they show as records
  on an `ok` invocation, not under `--status error`.

The gateway logs four records, each a plain object Workers Logs indexes by field:

| Record                                                                  | Level | When                                                             |
| ----------------------------------------------------------------------- | ----- | ---------------------------------------------------------------- |
| `{ event: "upstream_failure", status }`                                 | warn  | OpenRouter refuses `/api/messages` or a playground's first round |
| `{ event: "playground_round_failed", cause: "upstream", status }`       | warn  | a later round is refused, or the upstream fails mid-round        |
| `{ event: "playground_round_failed", cause: "internal", status: null }` | error | a bug in the playground loop ends the turn early                 |
| `{ event: "gateway_error" }`                                            | error | any other error a route throws; it answers a bare 500            |

`status` is the upstream's HTTP status, or `null` when there is none (a dropped connection, an
error event mid-stream). These records contain no error message or stack, headers, token, key,
body or turn. Cloudflare's invocation log still contains the request URL, including its query;
never put credentials or conversation contents in URLs. Browser cancellation in the playground
loop does not emit a failure record.

## Deploy with Workers Builds

Create the Worker from the GitHub repository (Workers & Pages, Create, Import a repository). The
Worker's name in the dashboard must be `yaklabs`, the `name` in `wrangler.jsonc`, or the build
fails. Then set, under Settings, Build:

| Setting        | Value                       |
| -------------- | --------------------------- |
| Root directory | `apps/gateway`              |
| Build command  | `pnpm --filter web build`   |
| Deploy command | `pnpm exec wrangler deploy` |

Builds installs the workspace's dependencies before the build command runs. Its image ships
pnpm 10.11.1, older than the `pnpm@10.33.0` this repo pins and the `allowBuilds` setting in
`pnpm-workspace.yaml`, so add a build variable (Settings, Build, Variables and secrets):

- `PNPM_VERSION` = `10.33.0`

And two runtime values (Settings, Variables and Secrets):

- `OPENROUTER_API_KEY`, type Secret: the OpenRouter API key
- `WORKOS_CLIENT_ID`, type Text: the WorkOS client id (public; the browser carries it too)

Add the deployed address to WorkOS's redirect URIs (`https://<worker>/callback`) and CORS
origins (ADR-084), and build the web app with `VITE_AUTH=workos`, `VITE_WORKOS_CLIENT_ID` and
`VITE_WORKOS_REDIRECT_URI` set as build variables (`apps/web/README.md`).
