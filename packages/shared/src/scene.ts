export const DEFAULT_CANVAS = {
  width: 1920,
  height: 1080
} as const;

export type LayerType = "background" | "text" | "image" | "video" | "shape" | "sprite";

export type AnimationType = "move" | "fade" | "scale" | "rotate";

export type AnimationEasing = "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";

export interface LayerAnimation {
  type: AnimationType;
  durationMs: number;
  delayMs?: number;
  loop?: boolean;
  easing?: AnimationEasing;
  from?: Partial<LayerTransform>;
  to?: Partial<LayerTransform>;
}

export interface LayerTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export interface BaseLayer {
  id: string;
  type: LayerType;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  opacity: number;
  visible: boolean;
  rotation?: number;
  animation?: LayerAnimation;
}

export interface BackgroundLayer extends BaseLayer {
  type: "background";
  color?: string;
  assetUrl?: string;
  fit?: "cover" | "contain" | "stretch";
}

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  color: string;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: "400" | "500" | "600" | "700" | "800";
  align?: "left" | "center" | "right";
  lineHeight?: number;
}

export interface MediaLayer extends BaseLayer {
  type: "image" | "video" | "sprite";
  assetUrl: string;
  fit?: "cover" | "contain" | "stretch";
  autoplay?: boolean;
  loop?: boolean;
}

export interface ShapeLayer extends BaseLayer {
  type: "shape";
  shape: "rectangle" | "circle";
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

export type SceneLayer = BackgroundLayer | TextLayer | MediaLayer | ShapeLayer;

export interface Scene {
  id: string;
  title: string;
  canvas: {
    width: number;
    height: number;
  };
  backgroundColor?: string;
  layers: SceneLayer[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DisplayCapabilities {
  canvas: {
    width: number;
    height: number;
  };
  supportsVideo: boolean;
  supportsPixi: boolean;
}

export const createDefaultScene = (title = "Untitled Scene"): Scene => ({
  id: cryptoRandomId("scene"),
  title,
  canvas: { ...DEFAULT_CANVAS },
  backgroundColor: "#101820",
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
      color: "#101820"
    }
  ]
});

export const cryptoRandomId = (prefix: string): string => {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${random}`;
};
