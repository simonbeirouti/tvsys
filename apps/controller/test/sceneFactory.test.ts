import { describe, expect, it } from "vitest";
import { DEFAULT_CANVAS } from "@tvsys/shared";
import { addImageLayer, createEditableScene, getCapabilityCanvas, updateFirstLayer } from "../src/sceneFactory.js";

describe("scene factory", () => {
  it("creates a scene with controllable text and moving shape layers", () => {
    const scene = createEditableScene();

    expect(scene.layers.some((layer) => layer.type === "text")).toBe(true);
    expect(scene.layers.some((layer) => layer.type === "shape" && Boolean(layer.animation))).toBe(true);
  });

  it("updates the first matching layer", () => {
    const scene = updateFirstLayer(createEditableScene(), "text", { text: "Updated" });
    const text = scene.layers.find((layer) => layer.type === "text");

    expect(text?.type === "text" && text.text).toBe("Updated");
  });

  it("adds uploaded images as layers", () => {
    const scene = addImageLayer(createEditableScene(), "http://localhost/image.png");

    expect(scene.layers.some((layer) => layer.type === "image")).toBe(true);
  });

  it("keeps authored scenes on the default 16:9 canvas", () => {
    const scene = createEditableScene();
    const background = scene.layers.find((layer) => layer.type === "background");

    expect(scene.canvas).toEqual(DEFAULT_CANVAS);
    expect(background?.width).toBe(DEFAULT_CANVAS.width);
    expect(background?.height).toBe(DEFAULT_CANVAS.height);
  });

  it("uses viewport capabilities as the editor canvas", () => {
    expect(
      getCapabilityCanvas({
        canvas: { width: 1920, height: 1080 },
        viewport: { width: 1366, height: 768 },
        supportsVideo: true,
        supportsPixi: true
      })
    ).toEqual({ width: 1366, height: 768 });
  });
});
