import { DEFAULT_CANVAS, cryptoRandomId, type DisplayCapabilities, type Scene, type SceneLayer } from "@tvsys/shared";

type CanvasSize = Scene["canvas"];

export const sceneAssetReference = (assetId: string): string => `asset:${assetId}`;

export const getCapabilityCanvas = (capabilities?: DisplayCapabilities): CanvasSize | undefined =>
  cleanCanvas(capabilities?.viewport) ?? cleanCanvas(capabilities?.canvas);

export const createEditableScene = (): Scene => ({
  id: cryptoRandomId("scene"),
  title: "Live Signage Scene",
  canvas: { ...DEFAULT_CANVAS },
  backgroundColor: "#08131f",
  layers: [
    {
      id: cryptoRandomId("layer"),
      type: "background",
      x: 0,
      y: 0,
      width: DEFAULT_CANVAS.width,
      height: DEFAULT_CANVAS.height,
      zIndex: 0,
      opacity: 1,
      visible: true,
      color: "#08131f"
    },
    {
      id: cryptoRandomId("layer"),
      type: "text",
      x: 120,
      y: 120,
      width: 960,
      height: 180,
      zIndex: 2,
      opacity: 1,
      visible: true,
      text: "Welcome",
      color: "#f6fbff",
      fontSize: 96,
      fontFamily: "Inter, Arial, sans-serif",
      fontWeight: "800",
      align: "left"
    },
    {
      id: cryptoRandomId("layer"),
      type: "shape",
      x: 1180,
      y: 660,
      width: 260,
      height: 260,
      zIndex: 3,
      opacity: 0.95,
      visible: true,
      shape: "circle",
      fill: "#f2c14e",
      animation: {
        type: "move",
        durationMs: 5000,
        loop: true,
        easing: "ease-in-out",
        from: { x: 1180, y: 660 },
        to: { x: 1450, y: 460 }
      }
    }
  ]
});

export const updateFirstLayer = <T extends SceneLayer["type"]>(
  scene: Scene,
  type: T,
  patch: Partial<Extract<SceneLayer, { type: T }>>
): Scene => ({
  ...scene,
  layers: scene.layers.map((layer) => (layer.type === type ? ({ ...layer, ...patch } as SceneLayer) : layer))
});

export const addImageLayer = (scene: Scene, assetUrl: string): Scene => ({
  ...scene,
  layers: [
    ...scene.layers,
    {
      id: cryptoRandomId("layer"),
      type: "image",
      x: 1120,
      y: 120,
      width: 620,
      height: 360,
      zIndex: 4,
      opacity: 1,
      visible: true,
      assetUrl,
      fit: "cover"
    }
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
