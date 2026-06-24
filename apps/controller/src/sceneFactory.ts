import { DEFAULT_CANVAS, cryptoRandomId, type DisplayCapabilities, type Scene, type SceneLayer } from "@tvsys/shared";

type CanvasSize = Scene["canvas"];

export const sceneAssetReference = (assetId: string): string => `asset:${assetId}`;

export const getCapabilityCanvas = (capabilities?: DisplayCapabilities): CanvasSize | undefined =>
  cleanCanvas(capabilities?.viewport) ?? cleanCanvas(capabilities?.canvas);

export const fallbackCanvas = (): CanvasSize => ({ ...DEFAULT_CANVAS });

export const createEditableScene = (canvas: CanvasSize = fallbackCanvas()): Scene =>
  resizeSceneToCanvas(
    {
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
    },
    canvas
  );

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
      x: scaleValue(1120, scene.canvas.width / DEFAULT_CANVAS.width),
      y: scaleValue(120, scene.canvas.height / DEFAULT_CANVAS.height),
      width: scaleValue(620, scene.canvas.width / DEFAULT_CANVAS.width),
      height: scaleValue(360, scene.canvas.height / DEFAULT_CANVAS.height),
      zIndex: 4,
      opacity: 1,
      visible: true,
      assetUrl,
      fit: "cover"
    }
  ]
});

export const resizeSceneToCanvas = (scene: Scene, canvas: CanvasSize): Scene => {
  const targetCanvas = cleanCanvas(canvas) ?? fallbackCanvas();
  const sourceCanvas = cleanCanvas(scene.canvas) ?? fallbackCanvas();
  if (sourceCanvas.width === targetCanvas.width && sourceCanvas.height === targetCanvas.height) return scene;

  const scaleX = targetCanvas.width / sourceCanvas.width;
  const scaleY = targetCanvas.height / sourceCanvas.height;
  const fontScale = Math.min(scaleX, scaleY);

  return {
    ...scene,
    canvas: targetCanvas,
    layers: scene.layers.map((layer) => {
      const resized = {
        ...layer,
        x: scaleValue(layer.x, scaleX),
        y: scaleValue(layer.y, scaleY),
        width: scaleValue(layer.width, scaleX),
        height: scaleValue(layer.height, scaleY),
        animation: layer.animation
          ? {
              ...layer.animation,
              from: scaleTransform(layer.animation.from, scaleX, scaleY),
              to: scaleTransform(layer.animation.to, scaleX, scaleY)
            }
          : undefined
      } as SceneLayer;

      if (resized.type === "text") {
        return {
          ...resized,
          fontSize: scaleValue(resized.fontSize, fontScale)
        };
      }

      return resized;
    })
  };
};

const cleanCanvas = (canvas?: Partial<CanvasSize>): CanvasSize | undefined => {
  if (!canvas || !isPositiveNumber(canvas.width) || !isPositiveNumber(canvas.height)) return undefined;
  return {
    width: Math.round(canvas.width),
    height: Math.round(canvas.height)
  };
};

const scaleTransform = <T extends { x?: number; y?: number } | undefined>(transform: T, scaleX: number, scaleY: number): T => {
  if (!transform) return transform;
  return {
    ...transform,
    x: transform.x === undefined ? undefined : scaleValue(transform.x, scaleX),
    y: transform.y === undefined ? undefined : scaleValue(transform.y, scaleY)
  };
};

const scaleValue = (value: number, scale: number): number => Math.round(value * scale);

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
