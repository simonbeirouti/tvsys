export declare const DEFAULT_CANVAS: {
    readonly width: 1920;
    readonly height: 1080;
};
export type LayerType = "background" | "text" | "image" | "video" | "shape" | "sprite";
export type AnimationType = "move" | "fade" | "scale" | "rotate";
export type AnimationEasing = "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";
export type MotionPreset = "none" | "slide" | "pulse" | "fade" | "rotate";
export declare const MOTION_PRESETS: readonly ["none", "slide", "pulse", "fade", "rotate"];
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
export interface DisplaySize {
    width: number;
    height: number;
}
export type DisplayOrientation = "landscape" | "portrait" | "square";
export interface DisplayCapabilities {
    canvas: DisplaySize;
    viewport?: DisplaySize;
    screen?: DisplaySize;
    devicePixelRatio?: number;
    orientation?: DisplayOrientation;
    supportsVideo: boolean;
    supportsPixi: boolean;
}
export declare const createDefaultScene: (title?: string) => Scene;
export declare const createBlankScene: (title?: string, backgroundColor?: string) => Scene;
export declare const createBackgroundLayer: (input?: Partial<BackgroundLayer>) => BackgroundLayer;
export declare const createTextLayer: (input?: Partial<TextLayer>) => TextLayer;
export declare const createMediaLayer: (input: Partial<MediaLayer> & Pick<MediaLayer, "assetUrl"> & {
    type?: MediaLayer["type"];
}) => MediaLayer;
export declare const createShapeLayer: (input?: Partial<ShapeLayer>) => ShapeLayer;
export declare const createMotionAnimation: (preset: MotionPreset, layer: Pick<BaseLayer, "x" | "y" | "opacity" | "rotation">, input?: Partial<LayerAnimation>) => LayerAnimation | undefined;
export declare const cryptoRandomId: (prefix: string) => string;
//# sourceMappingURL=scene.d.ts.map