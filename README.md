# WebSocket-Controlled Samsung TV Signage System

TVSys is a TypeScript monorepo for controlling Samsung Tizen signage displays from a browser dashboard.

The controller and TV app do not talk directly to each other. Both connect to the server.

```text
Controller browser  <---- authenticated REST + WS ---->  TVSys server  <---- authenticated WS ---->  Samsung TV app
        |                                                     |
        | Supabase Auth session                              | service-role data access
        v                                                     v
 Supabase Auth                                      Supabase Postgres + Storage
```

## Apps

1. `apps/server`: authenticated REST API, WebSocket API, Supabase Postgres/Storage gateway, display state, and scene delivery.
2. `apps/controller`: browser dashboard for registering displays, grouping screens, editing scenes, uploading media, and sending content.
3. `apps/tv-client`: Tizen-ready TV app that connects to the server, renders scenes, sends heartbeats, and reports render status.
4. `packages/shared`: shared TypeScript scene models, WebSocket messages, and validators.

## Documentation

1. [Setup](docs/setup.md): requirements, first run, controller setup, TV client testing, Samsung/Tizen package installation, and remote operation.
2. [Deployment](docs/deployment.md): Fly.io deployment for the server from this pnpm workspace.
3. [Shared UI](docs/ui.md): shared Tailwind/shadcn package, app integration, component generation, and verification commands.

## Daily Use

1. Open the controller.
2. Confirm the server URL is correct.
3. Check which displays are online or offline.
4. Select a display to view heartbeat, app version, current scene version, acknowledged scene version, and last render error.
5. Edit the scene.
6. Upload media if needed.
7. Click `Send Selected` for one display.
8. Click `Broadcast` for all displays.
9. Use the TV app reset control only when reinstalling or relinking that screen to a cafe account.

## What Works Today

1. Sign operators and TVs in with Supabase email OTP.
2. Group displays by area, such as `Front counter`, `Kitchen`, or `Drive-through`.
3. Store a position label for each display, such as `Menu board left`.
4. View registered displays grouped by area in the controller.
5. View real-time online/offline state through controller WebSockets.
6. See last heartbeat, current scene version, last acknowledged version, app version, and last render error.
7. Link TVs to a cafe account with a stable local installation id.
8. Edit a simple scene and send it to one selected display or broadcast it to every display.
9. Upload image/video assets.
10. Persist cafes, displays, scenes, assets, and delivery history in Supabase Postgres.
11. Package the TV client as a Tizen `.wgt`.

## Not Built Yet

1. Email/password operator accounts beyond the current email OTP flow.
2. Short TV activation codes where the TV shows a code and the operator enters it in the controller.
3. Persistent per-device event logs and troubleshooting timeline.
4. More restrictive production CORS and rate limiting.
5. Organization/team support beyond the current one-Supabase-user-per-cafe ownership model.

See [backlog.md](backlog.md) for the working backlog.

## Troubleshooting

1. If the TV does not connect, check the server URL, port `8787`, and that the TV is signed in with the same cafe email as the controller.
2. If the TV is a real Samsung display, make sure the TV server URL is not `localhost`.
3. If the controller shows the display offline, confirm the TV app is open and can reach `/api/health`.
4. If content sends but the TV does not update, check the display is online and the TV did not report a render error.
5. If uploaded media does not show, confirm the media URL uses a server URL reachable by the TV.
6. If displays or scenes are missing, confirm the server is using the expected Supabase project and the migration in `packages/shared/supabase/migrations` has been applied.

## Production Notes

1. Run the server as a background service.
2. Use a stable LAN IP, DNS name, or public HTTPS endpoint.
3. Back up Supabase Postgres and Storage according to the Supabase project plan.
4. Keep TVs and server on a private VLAN where possible.
5. Use `wss://` behind a reverse proxy for remote deployments.
6. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; browser and Tizen builds should receive only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
7. Sign the Tizen package with the proper Samsung/Tizen certificate profile.
8. Keep a record of each physical TV, display ID, group, and position.
