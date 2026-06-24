# Setup

## Requirements

1. Install Node.js 24 or newer.
2. Install pnpm 10 or newer.
3. Create a Supabase project.
4. Apply the migrations in `packages/shared/supabase/migrations`.
5. Configure Supabase Auth email OTP templates to send a six-digit token.
6. Use a browser for the controller.
7. For real Samsung displays, install Tizen Studio, Tizen Device Manager, or the Tizen CLI.
8. Enable developer mode on the Samsung display.
9. Use a Samsung/Tizen certificate profile when signing production installs.

Important: never enter `localhost` as the server URL on the TV. On a TV, `localhost` means the TV itself. Use the server machine's LAN IP, hostname, or public HTTPS URL, such as `http://192.168.1.20:8787` or `https://signage.example.com`.

## Supabase Setup

1. Create or select a Supabase project.
2. Apply the migration:

   ```bash
   pnpm supabase:db:push
   ```

   Or run the SQL in `packages/shared/supabase/migrations/202606190001_supabase_ownership.sql` through the Supabase SQL editor.

3. Confirm the private Storage bucket exists:

   ```text
   tvsys-assets
   ```

4. In Supabase Auth email templates, use the OTP token variable so users receive a six-digit code rather than only a magic link.

5. Collect these values:

   ```text
   SUPABASE_URL
   SUPABASE_PUBLISHABLE_KEY
   SUPABASE_SERVICE_ROLE_KEY
   ```

Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Do not expose it to Vite apps, Tizen builds, browser config, or checked-in files.

## Environment

Server:

```bash
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_PUBLISHABLE_KEY="YOUR_PUBLISHABLE_KEY"
export SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
export SUPABASE_ASSET_BUCKET="tvsys-assets"
export SUPABASE_SIGNED_URL_TTL_SECONDS="3600"
```

Controller and TV client:

```bash
export VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="YOUR_PUBLISHABLE_KEY"
```

The server also supports:

```bash
export HOST="0.0.0.0"
export PORT="8787"
export HEARTBEAT_TIMEOUT_MS="90000"
```

## First Run

1. Install the project.

   ```bash
   pnpm install
   ```

2. Build and test everything.

   ```bash
   pnpm -r typecheck
   pnpm -r test
   pnpm -r build
   ```

3. Start the server.

   ```bash
   pnpm --filter @tvsys/server dev
   ```

4. Find the server URL.

   Local browser testing:

   ```text
   http://localhost:8787
   ```

   LAN install on macOS:

   ```bash
   ipconfig getifaddr en0
   ```

   If that prints `192.168.1.20`, use:

   ```text
   http://192.168.1.20:8787
   ```

5. Check that the server is healthy.

   ```bash
   curl http://localhost:8787/api/health
   ```

   Expected shape:

   ```json
   {"ok":true,"at":"..."}
   ```

6. Start the controller.

   ```bash
   pnpm --filter @tvsys/controller dev
   ```

   Open:

   ```text
   http://localhost:5173
   ```

7. Sign in to the controller.

   1. Enter the TVSys server URL.
   2. Enter the cafe email.
   3. Enter the six-digit OTP from Supabase.

   The first sign-in creates or recovers the cafe row for that Supabase Auth user.

8. Create or organize displays in the controller.

   Use `group` for the cafe area and `position` for the physical screen location.

   Example setup:

   | Display ID | Display name | Group | Position |
   | --- | --- | --- | --- |
   | `front-left` | Front Left Menu | Front counter | Menu board left |
   | `front-right` | Front Right Menu | Front counter | Menu board right |
   | `kitchen-pass` | Kitchen Pass Screen | Kitchen | Pass screen |
   | `drive-main` | Drive-through Main | Drive-through | Main order screen |

   Displays created in the controller are owned by the signed-in cafe. TVs that sign in directly also create or relink owned display records through `/api/tv/register`.

9. Test with the browser TV client before installing on a real TV.

   ```bash
   pnpm --filter @tvsys/tv-client dev
   ```

   Open:

   ```text
   http://localhost:5174
   ```

   Enter:

   ```text
   Server URL: http://localhost:8787
   Cafe email: same cafe email used in the controller
   OTP:        six-digit code from Supabase
   ```

   The TV client generates a stable local `installationId`, registers itself with the server, receives a display id, and connects to the display WebSocket.

10. Send content to one screen.

    1. Select the display in the controller.
    2. Edit the scene headline, background color, movement, or media.
    3. Upload media if needed.
    4. Click `Send selected`.
    5. Confirm the TV updates.
    6. Confirm the controller shows a render acknowledgement.

11. Broadcast content to every owned screen.

    1. Confirm at least one individual send works.
    2. Edit the shared scene.
    3. Click `Broadcast`.
    4. Check each display's online and acknowledgement state.

## Samsung/Tizen Package

1. Build the Samsung/Tizen package.

   ```bash
   pnpm --filter @tvsys/tv-client package:tizen
   ```

   This creates:

   ```text
   apps/tv-client/build/tvsys-display.wgt
   ```

2. Install the TV app on the Samsung display.

   1. Enable developer mode on the display.
   2. Confirm the display can reach the TVSys server URL.
   3. Connect to the display with Tizen Device Manager or the Tizen CLI.
   4. Install the generated `.wgt`.
   5. Launch the app on the TV.

   Tizen CLI example:

   ```bash
   tizen install -n apps/tv-client/build/tvsys-display.wgt
   ```

3. Link the TV.

   On first launch, enter:

   ```text
   Server URL: http://192.168.1.20:8787
   Cafe email: cafe email
   OTP:        six-digit code from Supabase
   ```

   The display should appear online in the controller for the same signed-in cafe.

## Remote Operation

1. Deploy `apps/server` on a machine that TVs and operators can reach.
2. Put the server behind HTTPS/WSS for remote access.
3. Use a stable public URL, for example:

   ```text
   https://signage.example.com
   wss://signage.example.com/ws/display
   wss://signage.example.com/ws/controller
   ```

4. Configure the server with Supabase secrets.
5. Host the controller as a static app or run it locally with the Vite environment variables.
6. Package the TV client with the Vite Supabase environment variables.
7. Sign in to the controller with the cafe email.
8. Link each TV with the same cafe email and OTP flow.
9. Use the controller to send content to one display or broadcast to every display owned by that cafe.

## Troubleshooting

1. If the controller cannot sign in, confirm Supabase Auth OTP is enabled and the Vite `VITE_SUPABASE_*` variables are present.
2. If the server returns `401`, confirm the controller or TV is sending a fresh Supabase access token.
3. If a TV links but cannot connect to WebSocket, confirm the server URL uses `https`/`wss` remotely and that the TV can reach it.
4. If a display is missing from the controller, confirm the controller and TV signed in with the same cafe email.
5. If uploaded media does not render, confirm the server can write to the `tvsys-assets` bucket and create signed URLs.
6. If a TV is a real Samsung display, make sure the server URL is not `localhost`.
