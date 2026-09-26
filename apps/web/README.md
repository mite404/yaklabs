# web

The web version of the app (ADR-083): a React Router single-page app, built by Vite into
static files, that renders the catalog's thread with the profit card and its stepped slider.
The agent loop and the conversation store run in a Web Worker from `@yaklabs/runtime`
(ADR-076); the model sits behind `apps/gateway` (ADR-085).

## Routes

| Path          | What it shows                                                   | Sign-in   |
| ------------- | --------------------------------------------------------------- | --------- |
| `/`           | The thread beside the compose canvas (ADR-089)                  | required  |
| `/lab`        | The evaluation workbench: fixtures through the same validation  | required  |
| `/share.html` | One shared card from the link's fragment (ADR-064)              | public    |
| `/callback`   | Where WorkOS sends visitors back; the provider finishes sign-in | public    |

A rail on the left holds the Kay mark, Thread and Lab, and at its foot the theme and the account.
On `/`, the thread sits beside the compose canvas: drag a highlight out of the thread onto the
canvas to start a new thread of the same project with the highlight quoted in its compose box, or
drag a card by its header to see it large in a lane of its own. Open space always remains at the
end of the row for the next drop, and the divider between the thread and the canvas drags anywhere
along its length. Thread lanes persist with their conversations; a lane closed by its × stays
closed (`kay.canvas.hidden` in localStorage), and card lanes last the visit. The model is
`src/canvas.ts`, the surface `src/components/canvas.tsx`.

"Required" applies only when the build has sign-in turned on (below).

## Settings

Copy `.env.example` to `.env` and set what the build should do. Vite exposes every `VITE_`
variable to the browser, so nothing here is secret.

| Variable                   | Values               | Meaning                                              |
| -------------------------- | -------------------- | ---------------------------------------------------- |
| `VITE_AGENT`               | `lab` (default), `gateway` | Who answers: the scripted stand-in, or a model   |
| `VITE_GATEWAY_URL`         | an origin, or empty  | Empty means the Worker that serves the site (ADR-086)|
| `VITE_AUTH`                | `none` (default), `workos` | Whether visitors sign in through AuthKit         |
| `VITE_WORKOS_CLIENT_ID`    | the WorkOS client id | Needed with `workos`                                 |
| `VITE_WORKOS_REDIRECT_URI` | a URL                | Needed with `workos`; must be registered in WorkOS   |

`src/env.ts` parses them once into a shape with no half-set states, so a contradiction fails
at start rather than on the first sign-in.

## WorkOS

The WorkOS environment needs the callback registered as a redirect URI and the site's origin
as a CORS origin, both under User Management. For local work these are
`http://localhost:5173/callback` and `http://localhost:5173`. On localhost AuthKit runs in
dev mode and keeps tokens in `localStorage`; elsewhere it uses its cookie-based refresh.

## Run

```sh
pnpm dev:web                 # from the repo root, http://localhost:5173
pnpm --filter web typecheck  # React Router typegen, then tsc
pnpm --filter web test       # the env parser
pnpm --filter web build      # build/client, served by the gateway Worker as static assets
```

## Styling

`src/index.css` loads shadcn's globals from `@yaklabs/ui` and Kay's `tokens.css` in a
`catalog` cascade layer between Tailwind's preflight and its utilities, so the catalog keeps
its element styles while a class on a shadcn primitive still wins (ADR-082). The theme is the
root's `data-theme`, set by `src/theme.ts` and booted from the prerendered shell.

## Prove it in a browser

Two scripts drive the app in headless Chromium and exit 1 on any failed step, with screenshots
and a `results.json` in the output directory (`.artifacts/web/<stamp>/` by default).

```sh
rm -rf apps/web/node_modules/.vite              # optional: start from a cold Vite cache
pnpm dev:web                                    # in one terminal
node apps/web/scripts/web-check.mjs             # card, slider, reply, chip, reload, routes
node apps/web/scripts/auth-check.mjs --base http://127.0.0.1:5174   # against a WorkOS-mode server
```

`web-check.mjs` proves the vertical slice: the profit card renders, the slider reaches Net profit,
the reply names that view, the sent message carries the chip, and every turn survives a reload
from SQLite in the browser's private file system. `auth-check.mjs` proves the sign-in gate: a
signed-out visit leaves for WorkOS with the registered callback and the wanted path in `state`,
while `/share.html` and `/callback` stay public. The last results and screenshots sit in
`docs/trail/evidence/`.
