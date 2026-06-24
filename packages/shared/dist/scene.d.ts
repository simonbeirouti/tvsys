export declare const DEFAULT_CANVAS: {
    readonly width: 1920;
    readonly height: 1080;
};
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
export declare const createDefaultScene: (title?: string) => Scene;
export declare const cryptoRandomId: (prefix: string) => string;
//# sourceMappingURL=scene.d.ts.map