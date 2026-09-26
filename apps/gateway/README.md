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
  - streams the reply from `claude-opus-5` (adaptive thinking, `max_tokens` 8192 as a cost cap)
    as `application/x-ndjson`: one Messages API stream event per line, exactly as the SDK's
    `MessageStream.toReadableStream()` writes it. The browser reads it back with
    `MessageStream.fromReadableStream(response.body)`;
  - answers 502 `{ "error": "upstream", "status": <number | null> }` when the Anthropic API
    refuses the request, without the upstream body or the key.
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
`.dev.vars` is ignored by git and overrides `wrangler.jsonc`'s `vars` locally.

```sh
pnpm --filter gateway test        # vitest in node: routes, streaming, auth
pnpm --filter gateway typecheck
pnpm --filter gateway build       # wrangler deploy --dry-run into dist/, deploys nothing
```

The build bundles the web build as the Worker's assets, so `apps/web/build/client` must exist:
run `pnpm --filter web build` first. The root `pnpm build` orders the two through Turbo.

## Secrets and variables

| Binding             | Production                                            | Local       |
| ------------------- | ----------------------------------------------------- | ----------- |
| `ANTHROPIC_API_KEY` | secret: `wrangler secret put`, or a dashboard Secret  | `.dev.vars` |
| `WORKOS_CLIENT_ID`  | variable: `vars` in `wrangler.jsonc`, committed       | `.dev.vars` |

The client id is public (the browser bundle carries it too), and it belongs in `wrangler.jsonc`
rather than the dashboard: every `wrangler deploy` replaces the Worker's dashboard variables
with the config's `vars`, and `keep_vars` does not protect a variable the config also names.
Secrets survive deploys. Until both values are set, every `/api/*` request fails with a 500 that
names the missing binding; the client id must start with `client_`.

Token checks accept the issuers WorkOS's hosted API mints: `https://api.workos.com` for older
environments and `https://api.workos.com/user_management/<clientId>` for ones created since
mid-2025. A custom auth domain mints its own issuer, which `src/auth.ts` would need to accept.

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

And one runtime secret (Settings, Variables and Secrets, type Secret):

- `ANTHROPIC_API_KEY` = the Anthropic API key

`WORKOS_CLIENT_ID` goes in `wrangler.jsonc` and is committed, for the reason above. Add the
deployed address to WorkOS's allowed origins (ADR-084).
