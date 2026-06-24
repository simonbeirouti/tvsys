import { DEFAULT_CANVAS, type DisplayCapabilities, type DisplayOrientation, type DisplaySize } from "@tvsys/shared";

interface CapabilityDetectionSource {
  devicePixelRatio?: number;
  document?: {
    createElement?: (tagName: string) => { canPlayType?: unknown };
    documentElement?: {
      clientHeight?: number;
      clientWidth?: number;
    };
  };
  innerHeight?: number;
  innerWidth?: number;
  screen?: {
    height?: number;
    width?: number;
  } | null;
  visualViewport?: {
    height?: number;
    width?: number;
  } | null;
}

export const detectDisplayCapabilities = (source: CapabilityDetectionSource = globalThis as CapabilityDetectionSource): DisplayCapabilities => {
  const viewport =
    sizeFrom(source.visualViewport?.width, source.visualViewport?.height) ??
    sizeFrom(source.innerWidth, source.innerHeight) ??
    sizeFrom(source.document?.documentElement?.clientWidth, source.document?.documentElement?.clientHeight) ??
    sizeFrom(source.screen?.width, source.screen?.height) ??
    { ...DEFAULT_CANVAS };
  const screen = sizeFrom(source.screen?.width, source.screen?.height);

  return {
    canvas: viewport,
    viewport,
    screen,
    devicePixelRatio: positiveNumber(source.devicePixelRatio) ?? 1,
    orientation: orientationFor(viewport),
    supportsVideo: supportsVideo(source),
    supportsPixi: true
  };
};

const sizeFrom = (width: unknown, height: unknown): DisplaySize | undefined => {
  const cleanWidth = positiveNumber(width);
  const cleanHeight = positiveNumber(height);
  if (!cleanWidth || !cleanHeight) return undefined;
  return {
    width: Math.round(cleanWidth),
    height: Math.round(cleanHeight)
  };
};

const positiveNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

const orientationFor = (size: DisplaySize): DisplayOrientation => {
  if (size.width > size.height) return "landscape";
  if (size.height > size.width) return "portrait";
  return "square";
};

const supportsVideo = (source: CapabilityDetectionSource): boolean => {
  try {
    return typeof source.document?.createElement?.("video").canPlayType === "function";
  } catch {
    return false;
  }
};
