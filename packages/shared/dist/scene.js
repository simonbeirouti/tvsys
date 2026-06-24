export const DEFAULT_CANVAS = {
    width: 1920,
    height: 1080
};
export const MOTION_PRESETS = ["none", "slide", "pulse", "fade", "rotate"];
export const createDefaultScene = (title = "Untitled Scene") => ({
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
export const createBlankScene = (title = "Untitled Screen", backgroundColor = "#08131f") => ({
    id: cryptoRandomId("scene"),
    title,
    canvas: { ...DEFAULT_CANVAS },
    backgroundColor,
    layers: [createBackgroundLayer({ color: backgroundColor })]
});
export const createBackgroundLayer = (input = {}) => ({
    id: input.id ?? cryptoRandomId("layer"),
    type: "background",
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? DEFAULT_CANVAS.width,
    height: input.height ?? DEFAULT_CANVAS.height,
    zIndex: input.zIndex ?? 0,
    opacity: input.opacity ?? 1,
    visible: input.visible ?? true,
    color: input.color ?? "#08131f",
    assetUrl: input.assetUrl,
    fit: input.fit
});
export const createTextLayer = (input = {}) => ({
    id: input.id ?? cryptoRandomId("layer"),
    type: "text",
    name: input.name ?? "Text",
    x: input.x ?? 120,
    y: input.y ?? 120,
    width: input.width ?? 640,
    height: input.height ?? 180,
    zIndex: input.zIndex ?? 2,
    opacity: input.opacity ?? 1,
    visible: input.visible ?? true,
    rotation: input.rotation,
    animation: input.animation,
    text: input.text ?? "New text",
    color: input.color ?? "#f6fbff",
    fontSize: input.fontSize ?? 96,
    fontFamily: input.fontFamily ?? "Inter, Arial, sans-serif",
    fontWeight: input.fontWeight ?? "800",
    align: input.align ?? "left",
    lineHeight: input.lineHeight
});
export const createMediaLayer = (input) => ({
    id: input.id ?? cryptoRandomId("layer"),
    type: input.type ?? "image",
    name: input.name ?? (input.type === "video" ? "Video" : input.type === "sprite" ? "Dynamic asset" : "Image"),
    x: input.x ?? 1120,
    y: input.y ?? 120,
    width: input.width ?? 620,
    height: input.height ?? 360,
    zIndex: input.zIndex ?? 3,
    opacity: input.opacity ?? 1,
    visible: input.visible ?? true,
    rotation: input.rotation,
    animation: input.animation,
    assetUrl: input.assetUrl,
    fit: input.fit ?? "cover",
    autoplay: input.autoplay,
    loop: input.loop
});
export const createShapeLayer = (input = {}) => ({
    id: input.id ?? cryptoRandomId("layer"),
    type: "shape",
    name: input.name ?? "Shape",
    x: input.x ?? 720,
    y: input.y ?? 360,
    width: input.width ?? 320,
    height: input.height ?? 220,
    zIndex: input.zIndex ?? 3,
    opacity: input.opacity ?? 1,
    visible: input.visible ?? true,
    rotation: input.rotation,
    animation: input.animation,
    shape: input.shape ?? "rectangle",
    fill: input.fill ?? "#f2c14e",
    stroke: input.stroke,
    strokeWidth: input.strokeWidth
});
export const createMotionAnimation = (preset, layer, input = {}) => {
    if (preset === "none")
        return undefined;
    const durationMs = input.durationMs ?? 3000;
    const delayMs = input.delayMs ?? 0;
    const loop = input.loop ?? true;
    const easing = input.easing ?? "ease-in-out";
    if (preset === "slide") {
        return {
            type: "move",
            durationMs,
            delayMs,
            loop,
            easing,
            from: input.from ?? { x: layer.x, y: layer.y },
            to: input.to ?? { x: layer.x + 240, y: layer.y }
        };
    }
    if (preset === "pulse") {
        return {
            type: "scale",
            durationMs,
            delayMs,
            loop,
            easing,
            from: input.from ?? { scale: 0.9, opacity: layer.opacity },
            to: input.to ?? { scale: 1.08, opacity: Math.min(1, layer.opacity + 0.1) }
        };
    }
    if (preset === "fade") {
        return {
            type: "fade",
            durationMs,
            delayMs,
            loop,
            easing,
            from: input.from ?? { opacity: 0.25 },
            to: input.to ?? { opacity: layer.opacity }
        };
    }
    return {
        type: "rotate",
        durationMs,
        delayMs,
        loop,
        easing,
        from: input.from ?? { rotation: layer.rotation ?? 0 },
        to: input.to ?? { rotation: (layer.rotation ?? 0) + 360 }
    };
};
export const cryptoRandomId = (prefix) => {
    const random = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 12);
    return `${prefix}_${random}`;
};
