import { describe, expect, it } from "vitest";
import { buildDisplayWsUrl, buildDisplayWsUrlWithToken, nextReconnectDelay, shouldApplySceneVersion } from "../src/connection.js";

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
});
