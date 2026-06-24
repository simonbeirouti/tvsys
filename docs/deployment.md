# Deployment

The production server is deployed on Fly.io:

```text
https://tvsys-server.fly.dev/
```

## Fly and the pnpm workspace

This repository is a pnpm workspace. Deploy individual apps, but build them from
the workspace root so Docker can access shared packages such as
`packages/shared`.

For the server:

```text
apps/server      Fly app
packages/shared  workspace dependency, not deployed directly
```

The Vite apps in `apps/controller` and `apps/tv-client` do not need to run on
Fly unless there is a specific reason to host them there. After build, they are
static assets and can be hosted by static hosting, served by the server, or, for
the TV client, packaged for Tizen.

## Supabase Requirements

Before deploying the server, create a Supabase project and apply the migrations
in `packages/shared/supabase/migrations`.

The server requires these secrets:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ASSET_BUCKET
SUPABASE_SIGNED_URL_TTL_SECONDS
```

`SUPABASE_SERVICE_ROLE_KEY` must only be configured on the server. The
controller and TV client use only:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Set Fly secrets from the workspace root:

```sh
fly secrets set \
  SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  SUPABASE_PUBLISHABLE_KEY="YOUR_PUBLISHABLE_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
  SUPABASE_ASSET_BUCKET="tvsys-assets" \
  SUPABASE_SIGNED_URL_TTL_SECONDS="3600" \
  --config apps/server/fly.toml
```

The server no longer needs a persistent SQLite data directory. Supabase Postgres
stores cafes, devices, scenes, assets, and delivery history. Supabase Storage
stores uploaded media.

## Generate the server Dockerfile

Fly's `fly launch --dockerfile ...` flag does not generate a Dockerfile. It only
tells Fly to use an existing Dockerfile.

Generate the Dockerfile with Fly's Dockerfile generator:

```sh
pnpm --dir apps/server dlx @flydotio/dockerfile@latest --force --port 8080 --cmd "node apps/server/dist/index.js"
mv Dockerfile apps/server/Dockerfile
```

The generator writes `Dockerfile` to the workspace root, even when invoked with
`pnpm --dir apps/server`, so move it into `apps/server/Dockerfile`.

Review the generated Dockerfile for workspace fixes. The server Dockerfile must:

- Copy `pnpm-workspace.yaml` before install.
- Copy `apps/server/package.json` before install.
- Copy `packages/shared/package.json` before install.
- Install with filters for the root package and server dependency graph.
- Build `@tvsys/shared` before `@tvsys/server`.
- Set `CI=true` so `pnpm prune --prod` does not abort in Docker due to no TTY.

## Generate the Fly config

After the Dockerfile exists, generate the Fly app config:

```sh
fly launch \
  --path . \
  --config apps/server/fly.toml \
  --dockerfile apps/server/Dockerfile \
  --name tvsys-server \
  --internal-port 8080 \
  --no-deploy
```

This creates `apps/server/fly.toml`.

Because `fly.toml` lives inside `apps/server`, Fly resolves the `[build]`
`dockerfile` path relative to that directory. Set it to:

```toml
[build]
  dockerfile = "Dockerfile"
```

Do not leave it as `apps/server/Dockerfile`; that makes Fly look for
`apps/server/apps/server/Dockerfile`.

## Deploy

Deploy from the workspace root:

```sh
fly deploy . --config apps/server/fly.toml
```

The `.` is important: it makes the Docker build context the workspace root, so
`packages/shared` is available during the build.

## Common failures

If `fly launch` fails with:

```text
npm error Unsupported URL Type "workspace:": workspace:*
```

Fly tried to install its Dockerfile generator with npm inside a pnpm workspace
package. Run the generator directly with `pnpm dlx` instead.

If deploy fails with:

```text
dockerfile '.../apps/server/apps/server/Dockerfile' not found
```

Change `apps/server/fly.toml` to:

```toml
[build]
  dockerfile = "Dockerfile"
```

If deploy fails with:

```text
ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY
```

Set this in the Dockerfile before `pnpm prune --prod` runs:

```dockerfile
ENV CI="true"
```
