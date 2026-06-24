import {
  createBlankScene,
  createMediaLayer,
  type DisplayCapabilities,
  type Scene,
  type SceneLayer
} from "@tvsys/shared";

type CanvasSize = Scene["canvas"];

export const sceneAssetReference = (assetId: string): string => `asset:${assetId}`;

export const getCapabilityCanvas = (capabilities?: DisplayCapabilities): CanvasSize | undefined =>
  cleanCanvas(capabilities?.viewport) ?? cleanCanvas(capabilities?.canvas);

export const createEditableScene = (): Scene => createBlankScene("Untitled screen", "#08131f");

export const updateFirstLayer = <T extends SceneLayer["type"]>(
  scene: Scene,
  type: T,
  patch: Partial<Extract<SceneLayer, { type: T }>>
): Scene => ({
  ...scene,
  layers: scene.layers.map((layer) => (layer.type === type ? ({ ...layer, ...patch } as SceneLayer) : layer))
});

export const addImageLayer = (
  scene: Scene,
  assetUrl: string,
  position?: { x: number; y: number },
  type: "image" | "video" = "image"
): Scene => ({
  ...scene,
  layers: [
    ...scene.layers,
    createMediaLayer({
      assetUrl,
      type,
      x: position?.x,
      y: position?.y,
      zIndex: scene.layers.reduce((max, layer) => Math.max(max, layer.zIndex), 0) + 1
    })
  ]
});

const cleanCanvas = (canvas?: Partial<CanvasSize>): CanvasSize | undefined => {
  if (!canvas || !isPositiveNumber(canvas.width) || !isPositiveNumber(canvas.height)) return undefined;
  return {
    width: Math.round(canvas.width),
    height: Math.round(canvas.height)
  };
};

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
