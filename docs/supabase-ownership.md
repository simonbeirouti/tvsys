# Supabase Ownership Architecture

TVSys now uses Supabase Auth, Postgres, and Storage as the ownership boundary for cafes, TVs, scenes, and uploaded assets.

The short version:

```text
Controller browser  <---- authenticated REST + WS ---->  TVSys server  <---- authenticated WS ---->  TV client
        |                                                     |
        | Supabase Auth session                              | service-role data access
        v                                                     v
 Supabase Auth                                      Supabase Postgres + Storage
```

## Ownership Model

V1 treats one Supabase Auth user as one cafe account.

Every important row is scoped to that user:

1. `cafes.owner_user_id`
2. `devices.owner_user_id`
3. `assets.owner_user_id`
4. `scenes.owner_user_id`
5. `delivery_history.owner_user_id`

Supabase Row Level Security is enabled on the app tables. Policies use `to authenticated` and compare `(select auth.uid())` with `owner_user_id`. This means a signed-in cafe can only see and mutate its own rows when using normal authenticated Supabase access.

The server uses `SUPABASE_SERVICE_ROLE_KEY` because it is the trusted gateway for device status, scene delivery, and Storage URL signing. Browser clients must never receive that key.

## Shared Package

`packages/shared/src/supabase` contains shared Supabase building blocks:

1. `client.ts`: typed `createTvsysSupabaseClient`
2. `types.ts`: database row, insert, and update types
3. `auth.ts`: bearer-token/session helpers
4. `ownership.ts`: owner-scoped DTO helpers for devices, assets, scenes, and delivery records

The controller and TV client use the shared client for Supabase Auth. The server also uses it for service-role database and Storage operations.

## Controller Flow

1. Operator opens the controller.
2. Controller creates a Supabase browser client from:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Operator enters cafe email.
4. Controller calls Supabase `signInWithOtp`.
5. Operator enters the six-digit OTP.
6. Controller calls Supabase `verifyOtp` and receives a session.
7. Controller calls the TVSys server with `Authorization: Bearer <access_token>`.
8. Server validates the token with Supabase Auth and derives the owner user id.
9. Controller receives only devices, scenes, and assets owned by that user.

Controller WebSockets use the same session:

```text
wss://SERVER/ws/controller?access_token=SUPABASE_ACCESS_TOKEN
```

The server only sends status snapshots and live updates for devices owned by that token's user.

TanStack Query keys include the authenticated user id so IndexedDB persistence does not mix one cafe's cached data with another cafe's data.

## TV Client Flow

1. TV client launches.
2. TV operator enters server URL, cafe email, and OTP.
3. TV client verifies the OTP with Supabase and stores the Supabase session.
4. TV client creates or reuses a stable local `installationId`.
5. TV client calls:

   ```text
   POST /api/tv/register
   Authorization: Bearer <access_token>
   ```

6. Server validates the token and upserts a `devices` row owned by that user and keyed by `installation_id`.
7. Server returns the device/display id.
8. TV stores the display id and installation id locally.
9. TV connects to:

   ```text
   wss://SERVER/ws/display?access_token=SUPABASE_ACCESS_TOKEN
   ```

10. First display socket message is `register_display`, containing the returned display id, installation id, app version, and capabilities.
11. Server rejects the socket if the display does not belong to the authenticated user or if the installation id does not match.

After registration, the TV sends heartbeat, render acknowledgement, and render error messages through the WebSocket. The server applies those updates only to the authenticated owner's device row.

## Asset Flow

Uploaded assets go through the server, not directly from browser clients to Storage.

1. Controller uploads a file to `PUT /api/assets/:filename` with a Supabase bearer token.
2. Server validates the token.
3. Server writes the object to Supabase Storage under:

   ```text
   OWNER_USER_ID/ASSET_ID/SAFE_FILENAME
   ```

4. Server inserts an `assets` metadata row with the same `owner_user_id`.
5. Server returns an owner-authorized asset URL/reference.

Editable scenes should keep uploaded media as stable `asset:ASSET_ID` references. The controller may use the returned signed URL for local preview, but persisted scenes and delivery requests should not depend on that temporary URL.

When sending a scene to a TV, the server resolves owned asset references into short-lived signed Storage URLs. A TV can only receive signed URLs for assets owned by the same user that owns the TV.

## Scene Delivery Flow

Single-display delivery:

1. Controller posts `POST /api/displays/:id/scene` with a bearer token.
2. Server validates the user.
3. Server confirms the target device belongs to that user.
4. Server saves or versions the scene under that user.
5. Server writes a delivery history row.
6. Server resolves owned asset references.
7. Server pushes `scene_update` to the connected TV socket for that owned device.
8. TV renders and replies with `render_ack` or `render_error`.
9. Server updates the device and delivery history rows.
10. Server broadcasts the new device status to that user's controller sockets.

Broadcast delivery follows the same rules, except the target set is every device owned by the authenticated user.

## Public And Protected Endpoints

Public:

1. `GET /api/health`

Protected by `Authorization: Bearer <access_token>`:

1. `GET /api/me`
2. `GET /api/displays`
3. `POST /api/displays`
4. `PATCH /api/displays/:id`
5. `GET /api/scenes`
6. `POST /api/scenes`
7. `PUT /api/assets/:filename`
8. `POST /api/displays/:id/scene`
9. `POST /api/broadcast/scene`
10. `POST /api/tv/register`

Protected WebSockets:

1. `/ws/controller?access_token=...`
2. `/ws/display?access_token=...`

## Local State

Controller:

1. Supabase session is persisted by the Supabase browser client.
2. TanStack Query cache is persisted in IndexedDB.
3. Query keys are scoped by authenticated user id.
4. Sign-out clears the query client to avoid cache leakage.

TV client:

1. Supabase session is persisted by the Supabase browser client.
2. `tvsys.displayConfig` stores server URL, display id, and installation id.
3. `tvsys.installationId` stores the stable TV installation id.
4. Reset signs out and clears display config plus installation id.

## Required Environment Variables

Server:

```text
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ASSET_BUCKET=tvsys-assets
SUPABASE_SIGNED_URL_TTL_SECONDS=3600
```

Controller and TV client:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

The server URL is still entered in the controller and TV setup UI so local, LAN, and remote deployments can point at the right TVSys server.
