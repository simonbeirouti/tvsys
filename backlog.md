# TVSys Backlog

## Remote Operator Management

- Add operator accounts with email/password sign-in.
- Add sessions or JWT auth for controller REST and WebSocket requests.
- Add organizations/tenants so each cafe only sees its own displays, scenes, assets, and logs.
- Add roles for owner, manager, and support/admin access.
- Add password reset and account invitation flows.

## TV Pairing And Activation

- Replace manual server URL + display ID + pairing token setup with a TV activation flow.
- Show a short-lived linking code on the TV app at first launch.
- Let the operator enter that code in the controller to bind the TV to their cafe.
- Store the server URL in the packaged TV app for production builds.
- Rotate display pairing credentials after successful activation.
- Add a way to clear pairing from the TV and re-link it.
- Rate-limit activation attempts.

## Device Management

- Add a dedicated operator/admin device view.
- Group TVs by cafe area, venue section, or physical position.
- Let operators rename displays and update their position labels.
- Show online/offline state, last heartbeat, app version, render capabilities, current scene, scene version, and last acknowledgement.
- Add pairing-code view/reset controls for support workflows.
- Add remote actions where platform support allows it, such as resend current scene, clear error, request reconnect, or clear pairing.

## Troubleshooting And Logs

- Persist device events such as connected, disconnected, heartbeat stale, scene sent, scene delivered, render acknowledged, and render error.
- Expose per-device logs through the API.
- Add a device detail timeline in the controller.
- Add filters for errors, delivery history, and connection events.
- Capture useful TV diagnostics such as app version, browser/Tizen user agent, canvas size, video support, and Pixi/WebGL support.
- Add support/admin notes against a display.

## Production Hardening

- Serve the controller and server over HTTPS/WSS.
- Add API authentication and authorization before exposing the server publicly.
- Restrict CORS to known controller origins.
- Hash pairing tokens at rest instead of storing raw tokens.
- Add request rate limiting for login, activation, and pairing-token endpoints.
- Add backup/restore guidance for SQLite and asset storage.
- Add deployment docs for a reverse proxy, persistent data volume, and process manager.

