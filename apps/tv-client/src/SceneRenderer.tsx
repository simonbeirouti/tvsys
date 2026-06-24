import { Application, Assets, Graphics, Sprite } from "pixi.js";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { MediaLayer, Scene, SceneLayer, ShapeLayer } from "@tvsys/shared";

export const SceneRenderer = ({ scene }: { scene: Scene }) => {
  const staticLayers = useMemo(
    () => scene.layers.filter((layer) => layer.visible && layer.type !== "shape" && layer.type !== "sprite"),
    [scene.layers]
  );
  const pixiLayers = useMemo(
    () => scene.layers.filter((layer) => layer.visible && (layer.type === "shape" || layer.type === "sprite")),
    [scene.layers]
  );

  return (
    <div className="stage-shell">
      <div
        className="stage"
        style={{
          width: scene.canvas.width,
          height: scene.canvas.height,
          background: scene.backgroundColor ?? "#000"
        }}
      >
        {staticLayers.map((layer) => (
          <DomLayer key={layer.id} layer={layer} />
        ))}
        <PixiLayer scene={scene} layers={pixiLayers as Array<ShapeLayer | MediaLayer>} />
      </div>
    </div>
  );
};

const DomLayer = ({ layer }: { layer: SceneLayer }) => {
  const animation = animationStyle(layer);
  const style = {
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    zIndex: layer.zIndex,
    opacity: layer.opacity,
    transform: `rotate(${layer.rotation ?? 0}deg)`,
    animation
  } as CSSProperties;

  if (layer.type === "background") {
    return (
      <div
        className="scene-layer background-layer"
        style={{
          ...style,
          backgroundColor: layer.color,
          backgroundImage: layer.assetUrl ? `url(${layer.assetUrl})` : undefined,
          backgroundSize: layer.fit === "contain" ? "contain" : "cover"
        }}
      />
    );
  }

  if (layer.type === "text") {
    return (
      <div
        className="scene-layer text-layer"
        style={{
          ...style,
          color: layer.color,
          fontSize: layer.fontSize,
          fontFamily: layer.fontFamily,
          fontWeight: layer.fontWeight,
          justifyContent: layer.align === "center" ? "center" : layer.align === "right" ? "flex-end" : "flex-start",
          lineHeight: layer.lineHeight
        }}
      >
        {layer.text}
      </div>
    );
  }

  if (layer.type === "image") {
    return (
      <div className="scene-layer" style={style}>
        <img src={layer.assetUrl} alt="" />
      </div>
    );
  }

  if (layer.type === "video") {
    return (
      <div className="scene-layer" style={style}>
        <video src={layer.assetUrl} autoPlay={layer.autoplay ?? true} muted loop={layer.loop ?? true} />
      </div>
    );
  }

  return null;
};

const PixiLayer = ({ scene, layers }: { scene: Scene; layers: Array<ShapeLayer | MediaLayer> }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let app: Application | undefined;

    const run = async () => {
      if (!ref.current) return;
      ref.current.innerHTML = "";
      app = new Application();
      await app.init({
        width: scene.canvas.width,
        height: scene.canvas.height,
        backgroundAlpha: 0,
        antialias: true,
        resolution: 1
      });
      if (disposed || !ref.current) {
        app.destroy(true);
        return;
      }
      ref.current.appendChild(app.canvas);

      for (const layer of layers) {
        if (layer.type === "shape") {
          const graphics = new Graphics();
          if (layer.shape === "circle") {
            graphics.circle(layer.width / 2, layer.height / 2, Math.min(layer.width, layer.height) / 2).fill(layer.fill);
          } else {
            graphics.rect(0, 0, layer.width, layer.height).fill(layer.fill);
          }
          configurePixiObject(graphics, layer);
          app.stage.addChild(graphics);
          attachAnimation(app, graphics, layer);
        }

        if (layer.type === "sprite") {
          const texture = await Assets.load(layer.assetUrl);
          const sprite = new Sprite(texture);
          sprite.width = layer.width;
          sprite.height = layer.height;
          configurePixiObject(sprite, layer);
          app.stage.addChild(sprite);
          attachAnimation(app, sprite, layer);
        }
      }
    };

    void run();

    return () => {
      disposed = true;
      app?.destroy(true, { children: true });
    };
  }, [layers, scene.canvas.height, scene.canvas.width]);

  return <div className="pixi-layer" ref={ref} />;
};

const configurePixiObject = (object: Graphics | Sprite, layer: ShapeLayer | MediaLayer) => {
  object.x = layer.x;
  object.y = layer.y;
  object.alpha = layer.opacity;
  object.rotation = ((layer.rotation ?? 0) * Math.PI) / 180;
  object.zIndex = layer.zIndex;
};

const attachAnimation = (app: Application, object: Graphics | Sprite, layer: ShapeLayer | MediaLayer) => {
  if (!layer.animation) return;
  const from = layer.animation.from ?? {};
  const to = layer.animation.to ?? {};
  const start = performance.now() + (layer.animation.delayMs ?? 0);

  app.ticker.add(() => {
    const elapsed = performance.now() - start;
    if (elapsed < 0) return;
    const duration = layer.animation?.durationMs ?? 1000;
    const rawProgress = layer.animation?.loop ? (elapsed % duration) / duration : Math.min(elapsed / duration, 1);
    const progress = ease(rawProgress, layer.animation?.easing);

    if (from.x !== undefined || to.x !== undefined) object.x = lerp(from.x ?? layer.x, to.x ?? layer.x, progress);
    if (from.y !== undefined || to.y !== undefined) object.y = lerp(from.y ?? layer.y, to.y ?? layer.y, progress);
    if (from.opacity !== undefined || to.opacity !== undefined) object.alpha = lerp(from.opacity ?? layer.opacity, to.opacity ?? layer.opacity, progress);
    if (from.rotation !== undefined || to.rotation !== undefined) {
      object.rotation = (lerp(from.rotation ?? layer.rotation ?? 0, to.rotation ?? layer.rotation ?? 0, progress) * Math.PI) / 180;
    }
    if (from.scale !== undefined || to.scale !== undefined) {
      const scale = lerp(from.scale ?? 1, to.scale ?? 1, progress);
      object.scale.set(scale);
    }
  });
};

const animationStyle = (layer: SceneLayer): string | undefined => {
  if (!layer.animation) return undefined;
  const name = `move-${layer.id}`;
  return `${name} ${layer.animation.durationMs}ms ${layer.animation.easing ?? "linear"} ${layer.animation.delayMs ?? 0}ms ${
    layer.animation.loop ? "infinite" : "1"
  } alternate`;
};

export const SceneAnimationStyles = ({ scene }: { scene: Scene }) => (
  <style>
    {scene.layers
      .filter((layer) => layer.animation && layer.type !== "shape" && layer.type !== "sprite")
      .map((layer) => {
        const from = layer.animation?.from ?? {};
        const to = layer.animation?.to ?? {};
        return `
          @keyframes move-${layer.id} {
            from {
              transform: translate(${from.x ?? 0}px, ${from.y ?? 0}px) scale(${from.scale ?? 1}) rotate(${from.rotation ?? layer.rotation ?? 0}deg);
              opacity: ${from.opacity ?? layer.opacity};
            }
            to {
              transform: translate(${to.x ?? 0}px, ${to.y ?? 0}px) scale(${to.scale ?? 1}) rotate(${to.rotation ?? layer.rotation ?? 0}deg);
              opacity: ${to.opacity ?? layer.opacity};
            }
          }
        `;
      })
      .join("\n")}
  </style>
);

const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;

const ease = (progress: number, easing = "linear"): number => {
  if (easing === "ease-in") return progress * progress;
  if (easing === "ease-out") return 1 - (1 - progress) * (1 - progress);
  if (easing === "ease-in-out" || easing === "ease") return progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
  return progress;
};
