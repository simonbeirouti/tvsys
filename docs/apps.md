# Apps and Packages

TVSys is a pnpm monorepo. The apps are the runnable pieces; the packages are
shared code used by those apps.

## Quick Comparison

| Workspace | Role | Runtime | Env file | Run command | Output |
| --- | --- | --- | --- | --- | --- |
| `apps/server` | Trusted REST/WebSocket gateway | Node.js service | `apps/server/.env` | `pnpm --filter @tvsys/server dev` | `apps/server/dist` |
| `apps/controller` | Operator dashboard | Browser Vite app | `apps/controller/.env` | `pnpm --filter @tvsys/controller dev` | `apps/controller/dist` |
| `apps/tv-client` | Display runtime and Tizen app | Browser/Tizen Vite app | `apps/tv-client/.env` | `pnpm --filter @tvsys/tv-client dev` | `apps/tv-client/dist`, `apps/tv-client/build/tvsys-display.wgt` |
| `packages/shared` | Shared protocol, scene, validation, and Supabase helpers | TypeScript library | None | Not run directly | `packages/shared/dist` |
| `packages/ui` | Shared React components, hooks, and styles | React library | None | Not run directly | Typechecked source exports |

## Server

`apps/server` is the trusted backend. It exposes the REST API and WebSocket
connections used by both browser apps, signs media URLs, writes display state,
and talks to Supabase Postgres and Storage.

Only the server may use:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Local setup:

```bash
cp apps/server/.env.example apps/server/.env
pnpm --filter @tvsys/server dev
```

Production deployment is server-specific. The current deployment guide targets
Fly.io from the workspace root; see [Deployment](deployment.md).

## Controller

`apps/controller` is the operator dashboard. It is a Vite browser app for
signing in, registering displays, grouping screens, editing scenes, uploading
media, and sending content.

The controller talks to the TVSys server over authenticated REST and WebSocket
connections. It also uses Supabase Auth in the browser, so it must only receive
publishable Supabase values:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Local setup:

```bash
cp apps/controller/.env.example apps/controller/.env
pnpm --filter @tvsys/controller dev
```

Default local URL:

```text
http://localhost:5173
```

## TV Client

`apps/tv-client` is the display app. It can run in a browser for testing, and it
can be packaged as a Samsung/Tizen `.wgt`.

The TV client connects to the server as a display, renders scenes, sends
heartbeats, and reports render status. Like the controller, it is browser-side
code and must only receive publishable Supabase values:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Local browser setup:

```bash
cp apps/tv-client/.env.example apps/tv-client/.env
pnpm --filter @tvsys/tv-client dev
```

Default local URL:

```text
http://localhost:5174
```

Tizen package:

```bash
pnpm --filter @tvsys/tv-client package:tizen
```

Package output:

```text
apps/tv-client/build/tvsys-display.wgt
```

## Shared Package

`packages/shared` contains shared scene models, WebSocket protocol types,
validators, and Supabase client/type helpers. It is consumed by the server,
controller, and TV client.

It is not a runnable app and does not need an env file. Build it when validating
library output:

```bash
pnpm --filter @tvsys/shared build
```

The generated `packages/shared/dist` files are intentionally committed so
workspace consumers can resolve the package consistently.

## UI Package

`packages/ui` contains shared React components, hooks, utilities, and global
styles used by the browser-facing apps.

It is not a runnable app and does not need an env file. Validate it with:

```bash
pnpm --filter @tvsys/ui typecheck
```

The controller and TV client import UI pieces from this package instead of
duplicating component code.

## Root Commands

Run these from the repository root:

```bash
pnpm dev
pnpm -r typecheck
pnpm -r test
pnpm -r build
```

The server loads `apps/server/.env` automatically. The Vite apps read their own
`.env` files automatically. The controller uses port `5173`, and the TV client
uses port `5174`; if either port is busy, stop the existing dev server before
running the command again.
