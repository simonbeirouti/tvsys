import { describe, expect, it } from "vitest";
import { createDefaultScene, validateScene } from "../src/index.js";

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
});
