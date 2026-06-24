import { describe, expect, it } from "vitest";
import { addImageLayer, createEditableScene, updateFirstLayer } from "../src/sceneFactory.js";

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
});
