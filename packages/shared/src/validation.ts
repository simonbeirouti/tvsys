import { DEFAULT_CANVAS, type DisplayCapabilities, type Scene, type SceneLayer } from "./scene.js";

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: string[];
}

export const parseJsonMessage = (raw: string): ValidationResult<unknown> => {
  try {
    return { ok: true, value: JSON.parse(raw), errors: [] };
  } catch {
    return { ok: false, errors: ["Message is not valid JSON"] };
  }
};

export const validateScene = (value: unknown): ValidationResult<Scene> => {
  const errors: string[] = [];
  const scene = value as Partial<Scene>;

  if (!isObject(scene)) {
    return { ok: false, errors: ["Scene must be an object"] };
  }

  if (!isNonEmptyString(scene.id)) errors.push("Scene id is required");
  if (!isNonEmptyString(scene.title)) errors.push("Scene title is required");
  if (!isObject(scene.canvas)) {
    errors.push("Scene canvas is required");
  } else {
    if (!isPositiveNumber(scene.canvas.width)) errors.push("Scene canvas width must be positive");
    if (!isPositiveNumber(scene.canvas.height)) errors.push("Scene canvas height must be positive");
  }

  if (!Array.isArray(scene.layers)) {
    errors.push("Scene layers must be an array");
  } else {
    scene.layers.forEach((layer, index) => {
      errors.push(...validateLayer(layer, index));
    });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: scene as Scene, errors: [] };
};

export const normalizeScene = (scene: Scene): Scene => ({
  ...scene,
  canvas: {
    width: scene.canvas?.width || DEFAULT_CANVAS.width,
    height: scene.canvas?.height || DEFAULT_CANVAS.height
  },
  layers: [...scene.layers].sort((a, b) => a.zIndex - b.zIndex)
});

export const validateCapabilities = (value: unknown): value is DisplayCapabilities => {
  if (!isObject(value)) return false;
  const capabilities = value as Partial<DisplayCapabilities>;
  return (
    isSize(capabilities.canvas) &&
    (capabilities.viewport === undefined || isSize(capabilities.viewport)) &&
    (capabilities.screen === undefined || isSize(capabilities.screen)) &&
    (capabilities.devicePixelRatio === undefined || isPositiveNumber(capabilities.devicePixelRatio)) &&
    (capabilities.orientation === undefined || ["landscape", "portrait", "square"].includes(capabilities.orientation)) &&
    typeof capabilities.supportsVideo === "boolean" &&
    typeof capabilities.supportsPixi === "boolean"
  );
};

const validateLayer = (value: unknown, index: number): string[] => {
  const errors: string[] = [];
  const layer = value as Partial<SceneLayer>;
  const prefix = `Layer ${index + 1}`;

  if (!isObject(layer)) return [`${prefix} must be an object`];
  if (!isNonEmptyString(layer.id)) errors.push(`${prefix} id is required`);
  if (!["background", "text", "image", "video", "shape", "sprite"].includes(String(layer.type))) {
    errors.push(`${prefix} has an unsupported type`);
  }

  for (const key of ["x", "y", "width", "height", "zIndex", "opacity"] as const) {
    if (typeof layer[key] !== "number" || Number.isNaN(layer[key])) {
      errors.push(`${prefix} ${key} must be a number`);
    }
  }

  if (typeof layer.visible !== "boolean") errors.push(`${prefix} visible must be a boolean`);
  if (typeof layer.opacity === "number" && (layer.opacity < 0 || layer.opacity > 1)) {
    errors.push(`${prefix} opacity must be between 0 and 1`);
  }

  if (layer.type === "text" && !isNonEmptyString(layer.text)) errors.push(`${prefix} text is required`);
  if ((layer.type === "image" || layer.type === "video" || layer.type === "sprite") && !isNonEmptyString(layer.assetUrl)) {
    errors.push(`${prefix} assetUrl is required`);
  }
  if (layer.type === "shape" && !isNonEmptyString(layer.fill)) errors.push(`${prefix} fill is required`);

  if (layer.animation) {
    if (!["move", "fade", "scale", "rotate"].includes(String(layer.animation.type))) {
      errors.push(`${prefix} animation type is unsupported`);
    }
    if (!isPositiveNumber(layer.animation.durationMs)) {
      errors.push(`${prefix} animation durationMs must be positive`);
    }
    if (
      layer.animation.easing !== undefined &&
      !["linear", "ease", "ease-in", "ease-out", "ease-in-out"].includes(String(layer.animation.easing))
    ) {
      errors.push(`${prefix} animation easing is unsupported`);
    }
  }

  return errors;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSize = (value: unknown): value is DisplayCapabilities["canvas"] =>
  isObject(value) && isPositiveNumber(value.width) && isPositiveNumber(value.height);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
