import { describe, expect, it } from "vitest";
import { createDefaultScene, validateCapabilities, validateScene, type HeartbeatMessage } from "../src/index.js";

describe("scene validation", () => {
  it("accepts a default scene", () => {
    expect(validateScene(createDefaultScene("Lobby")).ok).toBe(true);
  });

  it("rejects missing text content", () => {
    const scene = createDefaultScene("Broken");
    scene.layers.push({
      id: "layer_text",
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      zIndex: 1,
      opacity: 1,
      visible: true,
      text: "",
      color: "#fff",
      fontSize: 40
    });

    const result = validateScene(scene);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("text is required");
  });

  it("accepts extended display capabilities", () => {
    expect(
      validateCapabilities({
        canvas: { width: 1366, height: 768 },
        viewport: { width: 1366, height: 768 },
        screen: { width: 1920, height: 1080 },
        devicePixelRatio: 1.5,
        orientation: "landscape",
        supportsVideo: true,
        supportsPixi: true
      })
    ).toBe(true);
  });

  it("keeps legacy display capabilities valid", () => {
    expect(
      validateCapabilities({
        canvas: { width: 1920, height: 1080 },
        supportsVideo: true,
        supportsPixi: true
      })
    ).toBe(true);
  });

  it("rejects invalid extended capability fields", () => {
    expect(
      validateCapabilities({
        canvas: { width: 1920, height: 1080 },
        viewport: { width: 0, height: 1080 },
        devicePixelRatio: -1,
        orientation: "diagonal",
        supportsVideo: true,
        supportsPixi: true
      })
    ).toBe(false);
  });

  it("allows heartbeat messages to carry refreshed capabilities", () => {
    const heartbeat = {
      type: "heartbeat",
      displayId: "display-1",
      at: "2026-06-24T00:00:00.000Z",
      capabilities: {
        canvas: { width: 1280, height: 720 },
        viewport: { width: 1280, height: 720 },
        supportsVideo: true,
        supportsPixi: true
      }
    } satisfies HeartbeatMessage;

    expect(validateCapabilities(heartbeat.capabilities)).toBe(true);
  });
});
