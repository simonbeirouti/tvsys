import { describe, expect, it } from "vitest";
import { addImageLayer, createEditableScene, getCapabilityCanvas, resizeSceneToCanvas, updateFirstLayer } from "../src/sceneFactory.js";

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

  it("creates scenes for a target display canvas", () => {
    const scene = createEditableScene({ width: 1280, height: 720 });
    const background = scene.layers.find((layer) => layer.type === "background");
    const text = scene.layers.find((layer) => layer.type === "text");

    expect(scene.canvas).toEqual({ width: 1280, height: 720 });
    expect(background?.width).toBe(1280);
    expect(background?.height).toBe(720);
    expect(text?.type === "text" && text.fontSize).toBe(64);
  });

  it("resizes scene layers and animations for non-16:9 canvases", () => {
    const scene = resizeSceneToCanvas(createEditableScene(), { width: 1080, height: 1920 });
    const shape = scene.layers.find((layer) => layer.type === "shape");

    expect(scene.canvas).toEqual({ width: 1080, height: 1920 });
    expect(shape?.x).toBe(664);
    expect(shape?.y).toBe(1173);
    expect(shape?.width).toBe(146);
    expect(shape?.height).toBe(462);
    expect(shape?.animation?.from?.x).toBe(664);
    expect(shape?.animation?.to?.y).toBe(818);
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
