export const DEFAULT_CANVAS = {
    width: 1920,
    height: 1080
};
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
export const cryptoRandomId = (prefix) => {
    const random = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 12);
    return `${prefix}_${random}`;
};
