import { describe, expect, it } from "vitest";
import { createShapeLayer, createTextLayer, DEFAULT_CANVAS } from "@tvsys/shared";
import { addImageLayer, createEditableScene, getCapabilityCanvas, updateFirstLayer } from "../src/sceneFactory.js";

describe("scene factory", () => {
  it("creates a blank scene with a background layer", () => {
    const scene = createEditableScene();

    expect(scene.title).toBe("Untitled screen");
    expect(scene.layers).toHaveLength(1);
    expect(scene.layers[0]?.type).toBe("background");
  });

  it("updates the first matching layer", () => {
    const base = createEditableScene();
    const scene = updateFirstLayer({ ...base, layers: [...base.layers, createTextLayer()] }, "text", { text: "Updated" });
    const text = scene.layers.find((layer) => layer.type === "text");

    expect(text?.type === "text" && text.text).toBe("Updated");
  });

  it("adds uploaded images as layers", () => {
    const scene = addImageLayer(createEditableScene(), "http://localhost/image.png");

    expect(scene.layers.some((layer) => layer.type === "image")).toBe(true);
  });

  it("creates authored text and dynamic shape layers", () => {
    const text = createTextLayer({ text: "Menu" });
    const shape = createShapeLayer({ animation: { type: "move", durationMs: 1000, loop: true } });

    expect(text.text).toBe("Menu");
    expect(shape.animation?.type).toBe("move");
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
