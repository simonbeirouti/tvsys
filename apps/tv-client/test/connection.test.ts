import { describe, expect, it } from "vitest";
import { DEFAULT_CANVAS } from "@tvsys/shared";
import { detectDisplayCapabilities } from "../src/capabilities.js";
import { buildDisplayWsUrl, buildDisplayWsUrlWithToken, nextReconnectDelay, shouldApplySceneVersion, shouldRefreshDisplayToken, withRefreshedDisplayToken } from "../src/connection.js";
import { createHeartbeatMessage } from "../src/socket.js";

describe("display connection helpers", () => {
  it("builds display websocket URLs", () => {
    expect(buildDisplayWsUrl("http://localhost:8787")).toBe("ws://localhost:8787/ws/display");
    expect(buildDisplayWsUrl("https://example.test/")).toBe("wss://example.test/ws/display");
    expect(buildDisplayWsUrlWithToken("https://example.test/", "token value")).toBe("wss://example.test/ws/display?access_token=token%20value");
  });

  it("caps reconnect delay at ten seconds", () => {
    expect(nextReconnectDelay(0)).toBe(1000);
    expect(nextReconnectDelay(10)).toBe(10_000);
  });

  it("ignores stale scene versions", () => {
    expect(shouldApplySceneVersion(3, 2)).toBe(true);
    expect(shouldApplySceneVersion(2, 2)).toBe(false);
  });

  it("detects display token refresh windows", () => {
    expect(
      shouldRefreshDisplayToken({
        serverUrl: "http://localhost:8787",
        displayId: "display-1",
        displayAuthToken: "display_old",
        installationId: "install-1"
      })
    ).toBe(true);
    expect(
      shouldRefreshDisplayToken(
        {
          serverUrl: "http://localhost:8787",
          displayId: "display-1",
          displayAuthToken: "display_old",
          installationId: "install-1",
          displayTokenExpiresAt: "2026-06-20T00:00:00.000Z"
        },
        Date.parse("2026-06-10T00:00:00.000Z")
      )
    ).toBe(false);
    expect(
      shouldRefreshDisplayToken(
        {
          serverUrl: "http://localhost:8787",
          displayId: "display-1",
          displayAuthToken: "display_old",
          installationId: "install-1",
          displayTokenExpiresAt: "2026-06-16T00:00:00.000Z"
        },
        Date.parse("2026-06-10T00:00:00.000Z")
      )
    ).toBe(true);
  });

  it("updates persisted display tokens without changing device identity", () => {
    expect(
      withRefreshedDisplayToken(
        {
          serverUrl: "http://localhost:8787",
          displayId: "display-1",
          displayAuthToken: "display_old",
          installationId: "install-1"
        },
        "display_new",
        "2026-09-01T00:00:00.000Z"
      )
    ).toEqual({
      serverUrl: "http://localhost:8787",
      displayId: "display-1",
      displayAuthToken: "display_new",
      installationId: "install-1",
      displayTokenExpiresAt: "2026-09-01T00:00:00.000Z"
    });
  });

  it("detects visual viewport capabilities first", () => {
    const capabilities = detectDisplayCapabilities({
      visualViewport: { width: 1365.6, height: 767.8 },
      innerWidth: 1920,
      innerHeight: 1080,
      screen: { width: 3840, height: 2160 },
      devicePixelRatio: 1.25,
      document: {
        createElement: () => ({ canPlayType: () => "" })
      }
    });

    expect(capabilities.canvas).toEqual({ width: 1366, height: 768 });
    expect(capabilities.viewport).toEqual({ width: 1366, height: 768 });
    expect(capabilities.screen).toEqual({ width: 3840, height: 2160 });
    expect(capabilities.devicePixelRatio).toBe(1.25);
    expect(capabilities.orientation).toBe("landscape");
    expect(capabilities.supportsVideo).toBe(true);
  });

  it("falls back through window, document, screen, then default canvas", () => {
    expect(detectDisplayCapabilities({ innerWidth: 1024, innerHeight: 768 }).canvas).toEqual({ width: 1024, height: 768 });
    expect(
      detectDisplayCapabilities({
        document: { documentElement: { clientWidth: 800, clientHeight: 1280 } }
      }).canvas
    ).toEqual({ width: 800, height: 1280 });
    expect(detectDisplayCapabilities({ screen: { width: 720, height: 1280 } }).canvas).toEqual({ width: 720, height: 1280 });
    expect(detectDisplayCapabilities({}).canvas).toEqual(DEFAULT_CANVAS);
  });

  it("builds heartbeat messages with refreshed capabilities", () => {
    const heartbeat = createHeartbeatMessage("display-1");

    expect(heartbeat.type).toBe("heartbeat");
    expect(heartbeat.displayId).toBe("display-1");
    expect(heartbeat.capabilities?.canvas).toEqual(DEFAULT_CANVAS);
    expect(new Date(heartbeat.at).toString()).not.toBe("Invalid Date");
  });
});
