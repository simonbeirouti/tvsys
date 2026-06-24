import type { Scene, SceneLayer } from "@tvsys/shared";

export type CanvasPoint = { x: number; y: number };
export type ResizeHandle = "nw" | "ne" | "sw" | "se";

export const MIN_LAYER_SIZE = 24;
export const SNAP_STEP = 20;

export const screenToCanvasPoint = (
  point: CanvasPoint,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  canvas: Scene["canvas"]
): CanvasPoint => ({
  x: ((point.x - rect.left) / rect.width) * canvas.width,
  y: ((point.y - rect.top) / rect.height) * canvas.height
});

export const snapValue = (value: number, step = SNAP_STEP): number =>
  step > 0 ? Math.round(value / step) * step : value;

export const clampLayer = (layer: SceneLayer, canvas: Scene["canvas"]): SceneLayer => ({
  ...layer,
  x: clamp(layer.x, 0, Math.max(0, canvas.width - layer.width)),
  y: clamp(layer.y, 0, Math.max(0, canvas.height - layer.height)),
  width: clamp(layer.width, MIN_LAYER_SIZE, canvas.width),
  height: clamp(layer.height, MIN_LAYER_SIZE, canvas.height)
});

export const moveLayer = (layer: SceneLayer, delta: CanvasPoint, canvas: Scene["canvas"], snap = false): SceneLayer => {
  const next = {
    ...layer,
    x: layer.x + delta.x,
    y: layer.y + delta.y
  };
  return clampLayer(snap ? { ...next, x: snapValue(next.x), y: snapValue(next.y) } : next, canvas);
};

export const resizeLayer = (
  layer: SceneLayer,
  handle: ResizeHandle,
  delta: CanvasPoint,
  canvas: Scene["canvas"],
  snap = false
): SceneLayer => {
  const next = { ...layer };
  if (handle.includes("e")) next.width = layer.width + delta.x;
  if (handle.includes("s")) next.height = layer.height + delta.y;
  if (handle.includes("w")) {
    next.x = layer.x + delta.x;
    next.width = layer.width - delta.x;
  }
  if (handle.includes("n")) {
    next.y = layer.y + delta.y;
    next.height = layer.height - delta.y;
  }

  if (snap) {
    next.x = snapValue(next.x);
    next.y = snapValue(next.y);
    next.width = snapValue(next.width);
    next.height = snapValue(next.height);
  }

  if (next.width < MIN_LAYER_SIZE) {
    if (handle.includes("w")) next.x -= MIN_LAYER_SIZE - next.width;
    next.width = MIN_LAYER_SIZE;
  }
  if (next.height < MIN_LAYER_SIZE) {
    if (handle.includes("n")) next.y -= MIN_LAYER_SIZE - next.height;
    next.height = MIN_LAYER_SIZE;
  }

  if (next.x < 0) {
    next.width += next.x;
    next.x = 0;
  }
  if (next.y < 0) {
    next.height += next.y;
    next.y = 0;
  }
  if (next.x + next.width > canvas.width) next.width = canvas.width - next.x;
  if (next.y + next.height > canvas.height) next.height = canvas.height - next.y;

  return clampLayer(next, canvas);
};

export const duplicateLayer = (layer: SceneLayer, id: string, zIndex: number): SceneLayer => ({
  ...layer,
  id,
  name: layer.name ? `${layer.name} copy` : undefined,
  x: layer.x + SNAP_STEP,
  y: layer.y + SNAP_STEP,
  zIndex
});

export const reorderLayer = (layers: SceneLayer[], layerId: string, direction: "backward" | "forward"): SceneLayer[] => {
  const layer = layers.find((item) => item.id === layerId);
  if (!layer || layer.type === "background") return layers;
  const foreground = layers.filter((item) => item.type !== "background").sort((a, b) => a.zIndex - b.zIndex);
  const index = foreground.findIndex((item) => item.id === layerId);
  const nextIndex = direction === "forward" ? Math.min(foreground.length - 1, index + 1) : Math.max(0, index - 1);
  if (index === nextIndex) return layers;
  const reordered = [...foreground];
  const [removed] = reordered.splice(index, 1);
  if (!removed) return layers;
  reordered.splice(nextIndex, 0, removed);
  const zIndexById = new Map(reordered.map((item, itemIndex) => [item.id, itemIndex + 1]));
  return layers.map((item) => (item.type === "background" ? item : { ...item, zIndex: zIndexById.get(item.id) ?? item.zIndex }));
};

export const nextZIndex = (layers: SceneLayer[]): number =>
  layers.reduce((max, layer) => Math.max(max, layer.zIndex), 0) + 1;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
