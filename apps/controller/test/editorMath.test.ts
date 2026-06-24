import { createTextLayer, DEFAULT_CANVAS } from "@tvsys/shared";
import { describe, expect, it } from "vitest";
import { duplicateLayer, moveLayer, reorderLayer, resizeLayer, screenToCanvasPoint, snapValue } from "../src/editorMath.js";

describe("editor math", () => {
  it("converts screen coordinates into canvas coordinates", () => {
    expect(
      screenToCanvasPoint(
        { x: 500, y: 300 },
        { left: 100, top: 100, width: 800, height: 400 },
        DEFAULT_CANVAS
      )
    ).toEqual({ x: 960, y: 540 });
  });

  it("snaps values to the requested grid", () => {
    expect(snapValue(34, 20)).toBe(40);
    expect(snapValue(29, 10)).toBe(30);
  });

  it("moves layers while clamping them to the canvas", () => {
    const layer = createTextLayer({ x: 10, y: 10, width: 200, height: 100 });

    expect(moveLayer(layer, { x: -200, y: -200 }, DEFAULT_CANVAS)).toMatchObject({ x: 0, y: 0 });
  });

  it("resizes layers with minimum size and canvas bounds", () => {
    const layer = createTextLayer({ x: 10, y: 10, width: 200, height: 100 });

    expect(resizeLayer(layer, "nw", { x: 500, y: 500 }, DEFAULT_CANVAS)).toMatchObject({
      width: 24,
      height: 24
    });
    expect(resizeLayer(layer, "se", { x: 3000, y: 3000 }, DEFAULT_CANVAS)).toMatchObject({
      width: DEFAULT_CANVAS.width - layer.x,
      height: DEFAULT_CANVAS.height - layer.y
    });
  });

  it("duplicates and reorders foreground layers", () => {
    const layer = createTextLayer({ id: "layer_a", zIndex: 1 });
    const copy = duplicateLayer(layer, "layer_b", 2);
    const reordered = reorderLayer([layer, copy], "layer_a", "forward");

    expect(copy).toMatchObject({ id: "layer_b", x: layer.x + 20, y: layer.y + 20, zIndex: 2 });
    expect(reordered.find((item) => item.id === "layer_a")?.zIndex).toBe(2);
    expect(reordered.find((item) => item.id === "layer_b")?.zIndex).toBe(1);
  });
});
