import type { DisplayStatus, LayerAnimation, MotionPreset, OwnedDelivery, OwnedScene, Scene, SceneLayer } from "@tvsys/shared";
import { createMotionAnimation, createShapeLayer, createTextLayer, cryptoRandomId, MOTION_PRESETS } from "@tvsys/shared";
import { Badge } from "@tvsys/ui/components/badge";
import { Button } from "@tvsys/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@tvsys/ui/components/card";
import { Input } from "@tvsys/ui/components/input";
import { Label } from "@tvsys/ui/components/label";
import { ScrollArea } from "@tvsys/ui/components/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@tvsys/ui/components/select";
import { Separator } from "@tvsys/ui/components/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@tvsys/ui/components/sheet";
import { Slider } from "@tvsys/ui/components/slider";
import { Switch } from "@tvsys/ui/components/switch";
import { Textarea } from "@tvsys/ui/components/textarea";
import {
  BringToFront,
  Circle,
  Copy,
  FilePlus2,
  ImagePlus,
  Info,
  Layers,
  MousePointer2,
  Plus,
  Save,
  Send,
  Square,
  Trash2,
  Upload
} from "lucide-react";
import type * as React from "react";
import { useMemo, useRef, useState } from "react";
import {
  duplicateLayer,
  moveLayer,
  nextZIndex,
  reorderLayer,
  resizeLayer,
  screenToCanvasPoint,
  type CanvasPoint,
  type ResizeHandle
} from "./editorMath.js";

interface SceneEditorProps {
  activity: OwnedDelivery[];
  assetPreviewUrls: Record<string, string>;
  display: DisplayStatus;
  displayDraft: { groupName: string; name: string; positionLabel: string };
  displaysCount: number;
  isBroadcasting: boolean;
  isSavingScene: boolean;
  isSending: boolean;
  isRelinking: boolean;
  isUpdatingDisplay: boolean;
  isUploadingAsset: boolean;
  logs: string[];
  onBroadcast: () => void;
  onLoadScene: (scene: Scene) => void;
  onNewScene: () => void;
  onSaveAsCopy: () => void;
  onSaveDevice: () => void;
  onSaveScene: () => void;
  onSend: () => void;
  onRelink: (code: string) => void;
  onUpdateDisplayDraft: (draft: { groupName: string; name: string; positionLabel: string }) => void;
  onUploadAsset: (file: File, position?: CanvasPoint) => void;
  savedScenes: OwnedScene[];
  scene: Scene;
  selectedCapabilityCanvas?: Scene["canvas"];
  setScene: React.Dispatch<React.SetStateAction<Scene>>;
}

type DragState = {
  id: string;
  handle?: ResizeHandle;
  originLayer: SceneLayer;
  start: CanvasPoint;
  type: "move" | "resize";
};

export const SceneEditor = ({
  activity,
  assetPreviewUrls,
  display,
  displayDraft,
  displaysCount,
  isBroadcasting,
  isSavingScene,
  isSending,
  isRelinking,
  isUpdatingDisplay,
  isUploadingAsset,
  logs,
  onBroadcast,
  onLoadScene,
  onNewScene,
  onSaveAsCopy,
  onSaveDevice,
  onSaveScene,
  onSend,
  onRelink,
  onUpdateDisplayDraft,
  onUploadAsset,
  savedScenes,
  scene,
  selectedCapabilityCanvas,
  setScene
}: SceneEditorProps) => {
  const [selectedLayerId, setSelectedLayerId] = useState<string | undefined>();
  const [snapEnabled, setSnapEnabled] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | undefined>(undefined);
  const selectedLayer = scene.layers.find((layer) => layer.id === selectedLayerId);
  const backgroundLayer = scene.layers.find((layer) => layer.type === "background");
  const foregroundLayers = useMemo(
    () => scene.layers.filter((layer) => layer.type !== "background").sort((a, b) => b.zIndex - a.zIndex),
    [scene.layers]
  );

  const updateLayer = (layerId: string, patch: Partial<SceneLayer>) => {
    setScene((current) => ({
      ...current,
      layers: current.layers.map((layer) => (layer.id === layerId ? ({ ...layer, ...patch } as SceneLayer) : layer))
    }));
  };

  const replaceLayer = (nextLayer: SceneLayer) => {
    setScene((current) => ({
      ...current,
      layers: current.layers.map((layer) => (layer.id === nextLayer.id ? nextLayer : layer))
    }));
  };

  const addLayer = (layer: SceneLayer) => {
    setScene((current) => ({ ...current, layers: [...current.layers, { ...layer, zIndex: nextZIndex(current.layers) } as SceneLayer] }));
    setSelectedLayerId(layer.id);
  };

  const addDynamicLayer = () => {
    const layer = createShapeLayer({ name: "Dynamic block", shape: "circle", fill: "#5cc8ff", width: 220, height: 220 });
    addLayer({ ...layer, animation: createMotionAnimation("slide", layer) });
  };

  const deleteSelectedLayer = () => {
    if (!selectedLayer || selectedLayer.type === "background") return;
    setScene((current) => ({ ...current, layers: current.layers.filter((layer) => layer.id !== selectedLayer.id) }));
    setSelectedLayerId(undefined);
  };

  const duplicateSelectedLayer = () => {
    if (!selectedLayer || selectedLayer.type === "background") return;
    const copy = duplicateLayer(selectedLayer, cryptoRandomId("layer"), nextZIndex(scene.layers));
    setScene((current) => ({ ...current, layers: [...current.layers, copy] }));
    setSelectedLayerId(copy.id);
  };

  const beginDrag = (event: React.PointerEvent, layer: SceneLayer, type: "move" | "resize", handle?: ResizeHandle) => {
    if (layer.type === "background") return;
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedLayerId(layer.id);
    dragRef.current = {
      id: layer.id,
      type,
      handle,
      start: screenToCanvasPoint({ x: event.clientX, y: event.clientY }, rect, scene.canvas),
      originLayer: layer
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    const point = screenToCanvasPoint({ x: event.clientX, y: event.clientY }, rect, scene.canvas);
    const delta = { x: point.x - drag.start.x, y: point.y - drag.start.y };
    replaceLayer(
      drag.type === "move"
        ? moveLayer(drag.originLayer, delta, scene.canvas, snapEnabled)
        : resizeLayer(drag.originLayer, drag.handle ?? "se", delta, scene.canvas, snapEnabled)
    );
  };

  const endDrag = (event: React.PointerEvent) => {
    dragRef.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const updateBackground = (color: string) => {
    setScene((current) => ({
      ...current,
      backgroundColor: color,
      layers: current.layers.map((layer) => (layer.type === "background" ? { ...layer, color } : layer))
    }));
  };

  const loadScene = (saved: OwnedScene) => {
    onLoadScene(saved.scene);
    setSelectedLayerId(undefined);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!file || !rect) return;
    const point = screenToCanvasPoint({ x: event.clientX, y: event.clientY }, rect, scene.canvas);
    onUploadAsset(file, point);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selectedLayer || selectedLayer.type === "background") return;
    const step = event.shiftKey ? 20 : 4;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelectedLayer();
      return;
    }
    const deltas: Record<string, CanvasPoint> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step }
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    replaceLayer(moveLayer(selectedLayer, delta, scene.canvas, false));
  };

  return (
    <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="grid min-h-0 content-start gap-4">
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Screen preview</CardTitle>
              <CardDescription>{scene.title}</CardDescription>
            </div>
            <CardAction className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setSnapEnabled((current) => !current)}>
                <MousePointer2 />
                {snapEnabled ? "Snap on" : "Snap off"}
              </Button>
              <DeviceSheet
                activity={activity}
                display={display}
                displayDraft={displayDraft}
                isUpdatingDisplay={isUpdatingDisplay}
                isRelinking={isRelinking}
                logs={logs}
                onRelink={onRelink}
                onSaveDevice={onSaveDevice}
                onUpdateDisplayDraft={onUpdateDisplayDraft}
                scene={scene}
                selectedCapabilityCanvas={selectedCapabilityCanvas}
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            <div
              className="overflow-hidden rounded-lg bg-slate-950"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              style={{ aspectRatio: `${scene.canvas.width} / ${scene.canvas.height}` }}
            >
              <div
                ref={canvasRef}
                tabIndex={0}
                className="relative size-full outline-none"
                onKeyDown={handleKeyDown}
                onPointerDown={() => setSelectedLayerId(undefined)}
                style={{ background: scene.backgroundColor }}
              >
                {snapEnabled ? (
                  <>
                    <span className="pointer-events-none absolute left-1/2 top-0 z-[999] h-full w-px bg-primary/30" />
                    <span className="pointer-events-none absolute left-0 top-1/2 z-[999] h-px w-full bg-primary/30" />
                  </>
                ) : null}
                {scene.layers
                  .filter((layer) => layer.visible)
                  .sort((a, b) => a.zIndex - b.zIndex)
                  .map((layer) => (
                    <LayerFrame
                      assetPreviewUrls={assetPreviewUrls}
                      isSelected={selectedLayerId === layer.id}
                      key={layer.id}
                      layer={layer}
                      onBeginDrag={beginDrag}
                      onEndDrag={endDrag}
                      onMove={updateDrag}
                      onSelect={setSelectedLayerId}
                      scene={scene}
                    />
                  ))}
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {scene.canvas.width} x {scene.canvas.height} · drop media onto the canvas
            </p>
          </CardContent>
        </Card>
      </section>

      <aside className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Screen</CardTitle>
            <CardDescription>Saved screens can be sent to this TV or all TVs.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Field label="Title" htmlFor="screen-title">
              <Input id="screen-title" value={scene.title} onChange={(event) => setScene((current) => ({ ...current, title: event.target.value }))} />
            </Field>
            <Field label="Background" htmlFor="screen-background">
              <Input
                className="h-9 p-1"
                id="screen-background"
                type="color"
                value={(backgroundLayer?.type === "background" && backgroundLayer.color) || scene.backgroundColor || "#08131f"}
                onChange={(event) => updateBackground(event.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={onSaveScene} disabled={isSavingScene}>
                <Save />
                Save
              </Button>
              <Button onClick={onSaveAsCopy} disabled={isSavingScene} variant="outline">
                <Copy />
                Save copy
              </Button>
              <Button onClick={onSend} disabled={isSending}>
                <Send />
                Send
              </Button>
              <Button onClick={onBroadcast} disabled={isBroadcasting || displaysCount === 0} variant="outline">
                <Upload />
                Broadcast
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assets</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button onClick={() => addLayer(createTextLayer())} variant="outline">
              <Plus />
              Text
            </Button>
            <Button onClick={() => addLayer(createShapeLayer())} variant="outline">
              <Square />
              Shape
            </Button>
            <Button onClick={addDynamicLayer} variant="outline">
              <Circle />
              Dynamic
            </Button>
            <Button asChild disabled={isUploadingAsset} variant="outline">
              <label>
                <ImagePlus />
                Media
                <input className="sr-only" type="file" accept="image/*,video/*" onChange={(event) => event.target.files?.[0] && onUploadAsset(event.target.files[0])} />
              </label>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Layers</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {foregroundLayers.length ? (
              foregroundLayers.map((layer) => (
                <button
                  className={`flex h-9 items-center gap-2 rounded-lg border px-2 text-left text-sm ${selectedLayerId === layer.id ? "border-primary bg-primary/10" : "border-border bg-background"}`}
                  key={layer.id}
                  onClick={() => setSelectedLayerId(layer.id)}
                  type="button"
                >
                  <Layers className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{layer.name ?? layerLabel(layer)}</span>
                  <Badge variant="outline">{layer.type}</Badge>
                </button>
              ))
            ) : (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Add text, media, shapes, or dynamic blocks.</p>
            )}
            <div className="grid grid-cols-4 gap-1">
              <Button disabled={!selectedLayer} size="icon-sm" title="Duplicate" variant="outline" onClick={duplicateSelectedLayer}>
                <Copy />
              </Button>
              <Button disabled={!selectedLayer} size="icon-sm" title="Bring forward" variant="outline" onClick={() => selectedLayerId && setScene((current) => ({ ...current, layers: reorderLayer(current.layers, selectedLayerId, "forward") }))}>
                <BringToFront />
              </Button>
              <Button disabled={!selectedLayer} size="icon-sm" title="Send backward" variant="outline" onClick={() => selectedLayerId && setScene((current) => ({ ...current, layers: reorderLayer(current.layers, selectedLayerId, "backward") }))}>
                <Layers />
              </Button>
              <Button disabled={!selectedLayer} size="icon-sm" title="Delete" variant="destructive" onClick={deleteSelectedLayer}>
                <Trash2 />
              </Button>
            </div>
          </CardContent>
        </Card>

        <LayerInspector layer={selectedLayer} onChange={updateLayer} />

        <Card>
          <CardHeader>
            <CardTitle>Saved screens</CardTitle>
            <CardAction>
              <Button size="icon-sm" title="New screen" variant="outline" onClick={onNewScene}>
                <FilePlus2 />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="grid gap-2 pr-3">
                {savedScenes.length ? (
                  savedScenes.map((saved) => (
                    <button
                      className="grid gap-0.5 rounded-lg border bg-background p-2 text-left text-sm hover:bg-muted"
                      key={saved.id}
                      onClick={() => loadScene(saved)}
                      type="button"
                    >
                      <span className="truncate font-medium">{saved.title}</span>
                      <span className="text-xs text-muted-foreground">v{saved.version} · {new Date(saved.updatedAt).toLocaleString()}</span>
                    </button>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No saved screens yet.</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
};

const LayerFrame = ({
  assetPreviewUrls,
  isSelected,
  layer,
  onBeginDrag,
  onEndDrag,
  onMove,
  onSelect,
  scene
}: {
  assetPreviewUrls: Record<string, string>;
  isSelected: boolean;
  layer: SceneLayer;
  onBeginDrag: (event: React.PointerEvent, layer: SceneLayer, type: "move" | "resize", handle?: ResizeHandle) => void;
  onEndDrag: (event: React.PointerEvent) => void;
  onMove: (event: React.PointerEvent) => void;
  onSelect: (layerId: string) => void;
  scene: Scene;
}) => {
  const style: React.CSSProperties = {
    left: `${(layer.x / scene.canvas.width) * 100}%`,
    top: `${(layer.y / scene.canvas.height) * 100}%`,
    width: `${(layer.width / scene.canvas.width) * 100}%`,
    height: `${(layer.height / scene.canvas.height) * 100}%`,
    zIndex: layer.zIndex,
    opacity: layer.opacity,
    transform: `rotate(${layer.rotation ?? 0}deg)`
  };

  return (
    <div
      className={`absolute overflow-hidden ${layer.type === "background" ? "pointer-events-none" : "cursor-move"} ${isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
      onPointerDown={(event) => {
        onSelect(layer.id);
        onBeginDrag(event, layer, "move");
      }}
      onPointerMove={onMove}
      onPointerUp={onEndDrag}
      style={style}
    >
      <LayerContent assetPreviewUrls={assetPreviewUrls} layer={layer} />
      {isSelected && layer.type !== "background"
        ? (["nw", "ne", "sw", "se"] as const).map((handle) => (
            <span
              className={`absolute z-10 size-3 rounded-sm border border-primary bg-background ${handle.includes("n") ? "top-0" : "bottom-0"} ${handle.includes("w") ? "left-0" : "right-0"} ${resizeCursor(handle)}`}
              key={handle}
              onPointerDown={(event) => onBeginDrag(event, layer, "resize", handle)}
              onPointerMove={onMove}
              onPointerUp={onEndDrag}
            />
          ))
        : null}
    </div>
  );
};

const LayerContent = ({ assetPreviewUrls, layer }: { assetPreviewUrls: Record<string, string>; layer: SceneLayer }) => {
  if (layer.type === "background") return null;
  if (layer.type === "text") {
    return (
      <div
        className="flex size-full items-center whitespace-pre-wrap"
        style={{
          color: layer.color,
          fontFamily: layer.fontFamily,
          fontSize: `clamp(12px, 5vw, ${layer.fontSize}px)`,
          fontWeight: layer.fontWeight,
          justifyContent: layer.align === "center" ? "center" : layer.align === "right" ? "flex-end" : "flex-start",
          lineHeight: layer.lineHeight
        }}
      >
        {layer.text}
      </div>
    );
  }
  if (layer.type === "shape") {
    return <span className="block size-full" style={{ background: layer.fill, borderRadius: layer.shape === "circle" ? "50%" : 6 }} />;
  }
  if (layer.type === "video") {
    return <video className="size-full object-cover" muted src={assetPreviewUrls[layer.assetUrl] ?? layer.assetUrl} />;
  }
  return <img className="size-full object-cover" src={assetPreviewUrls[layer.assetUrl] ?? layer.assetUrl} alt="" />;
};

const LayerInspector = ({ layer, onChange }: { layer?: SceneLayer; onChange: (layerId: string, patch: Partial<SceneLayer>) => void }) => {
  if (!layer || layer.type === "background") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inspector</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Select a layer to edit its placement, styling, and motion.</p>
        </CardContent>
      </Card>
    );
  }

  const patch = (value: Partial<SceneLayer>) => onChange(layer.id, value);
  const motionPreset = presetFromAnimation(layer.animation);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inspector</CardTitle>
        <CardDescription>{layerLabel(layer)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Field label="Name" htmlFor="layer-name">
          <Input id="layer-name" value={layer.name ?? ""} onChange={(event) => patch({ name: event.target.value } as Partial<SceneLayer>)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={layer.x} onChange={(x) => patch({ x } as Partial<SceneLayer>)} />
          <NumberField label="Y" value={layer.y} onChange={(y) => patch({ y } as Partial<SceneLayer>)} />
          <NumberField label="W" value={layer.width} onChange={(width) => patch({ width } as Partial<SceneLayer>)} />
          <NumberField label="H" value={layer.height} onChange={(height) => patch({ height } as Partial<SceneLayer>)} />
        </div>
        <div className="grid gap-2">
          <Label>Opacity</Label>
          <Slider min={0} max={1} step={0.01} value={[layer.opacity]} onValueChange={([opacity]) => patch({ opacity: opacity ?? 1 } as Partial<SceneLayer>)} />
        </div>
        <NumberField label="Rotation" value={layer.rotation ?? 0} onChange={(rotation) => patch({ rotation } as Partial<SceneLayer>)} />
        <div className="flex items-center justify-between rounded-lg border p-2">
          <Label htmlFor="layer-visible">Visible</Label>
          <Switch id="layer-visible" checked={layer.visible} onCheckedChange={(visible) => patch({ visible } as Partial<SceneLayer>)} />
        </div>

        {layer.type === "text" ? <TextControls layer={layer} patch={patch} /> : null}
        {layer.type === "shape" ? <ShapeControls layer={layer} patch={patch} /> : null}

        <Separator />
        <Field label="Motion preset" htmlFor="motion-preset">
          <Select
            value={motionPreset}
            onValueChange={(value) => {
              const preset = value as MotionPreset;
              patch({ animation: createMotionAnimation(preset, layer, layer.animation) } as Partial<SceneLayer>);
            }}
          >
            <SelectTrigger id="motion-preset" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOTION_PRESETS.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {preset}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {layer.animation ? <MotionControls animation={layer.animation} layer={layer} patch={patch} /> : null}
      </CardContent>
    </Card>
  );
};

const TextControls = ({ layer, patch }: { layer: Extract<SceneLayer, { type: "text" }>; patch: (value: Partial<SceneLayer>) => void }) => (
  <>
    <Field label="Text" htmlFor="layer-text">
      <Textarea id="layer-text" value={layer.text} onChange={(event) => patch({ text: event.target.value } as Partial<SceneLayer>)} />
    </Field>
    <div className="grid grid-cols-2 gap-2">
      <Field label="Color" htmlFor="text-color">
        <Input className="h-9 p-1" id="text-color" type="color" value={layer.color} onChange={(event) => patch({ color: event.target.value } as Partial<SceneLayer>)} />
      </Field>
      <NumberField label="Size" value={layer.fontSize} onChange={(fontSize) => patch({ fontSize } as Partial<SceneLayer>)} />
    </div>
  </>
);

const ShapeControls = ({ layer, patch }: { layer: Extract<SceneLayer, { type: "shape" }>; patch: (value: Partial<SceneLayer>) => void }) => (
  <div className="grid grid-cols-2 gap-2">
    <Field label="Fill" htmlFor="shape-fill">
      <Input className="h-9 p-1" id="shape-fill" type="color" value={layer.fill} onChange={(event) => patch({ fill: event.target.value } as Partial<SceneLayer>)} />
    </Field>
    <Field label="Shape" htmlFor="shape-kind">
      <Select value={layer.shape} onValueChange={(shape) => patch({ shape } as Partial<SceneLayer>)}>
        <SelectTrigger id="shape-kind" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="rectangle">rectangle</SelectItem>
          <SelectItem value="circle">circle</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  </div>
);

const MotionControls = ({
  animation,
  layer,
  patch
}: {
  animation: LayerAnimation;
  layer: SceneLayer;
  patch: (value: Partial<SceneLayer>) => void;
}) => {
  const updateAnimation = (next: Partial<LayerAnimation>) => patch({ animation: { ...animation, ...next } } as Partial<SceneLayer>);
  const updateTransform = (side: "from" | "to", key: string, value: number) => {
    updateAnimation({ [side]: { ...(animation[side] ?? {}), [key]: value } } as Partial<LayerAnimation>);
  };

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Duration" value={animation.durationMs} onChange={(durationMs) => updateAnimation({ durationMs })} />
        <NumberField label="Delay" value={animation.delayMs ?? 0} onChange={(delayMs) => updateAnimation({ delayMs })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Easing" htmlFor="motion-easing">
          <Select value={animation.easing ?? "linear" } onValueChange={(easing) => updateAnimation({ easing: easing as LayerAnimation["easing"] })}>
            <SelectTrigger id="motion-easing" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["linear", "ease", "ease-in", "ease-out", "ease-in-out"].map((easing) => (
                <SelectItem key={easing} value={easing}>
                  {easing}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-center justify-between self-end rounded-lg border p-2">
          <Label htmlFor="motion-loop">Loop</Label>
          <Switch id="motion-loop" checked={animation.loop ?? false} onCheckedChange={(loop) => updateAnimation({ loop })} />
        </div>
      </div>
      {animation.type === "move" ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="From X" value={animation.from?.x ?? layer.x} onChange={(value) => updateTransform("from", "x", value)} />
          <NumberField label="From Y" value={animation.from?.y ?? layer.y} onChange={(value) => updateTransform("from", "y", value)} />
          <NumberField label="To X" value={animation.to?.x ?? layer.x} onChange={(value) => updateTransform("to", "x", value)} />
          <NumberField label="To Y" value={animation.to?.y ?? layer.y} onChange={(value) => updateTransform("to", "y", value)} />
        </div>
      ) : null}
      {animation.type === "fade" ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="From opacity" step={0.05} value={animation.from?.opacity ?? 0.25} onChange={(value) => updateTransform("from", "opacity", value)} />
          <NumberField label="To opacity" step={0.05} value={animation.to?.opacity ?? layer.opacity} onChange={(value) => updateTransform("to", "opacity", value)} />
        </div>
      ) : null}
      {animation.type === "scale" ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="From scale" step={0.05} value={animation.from?.scale ?? 0.9} onChange={(value) => updateTransform("from", "scale", value)} />
          <NumberField label="To scale" step={0.05} value={animation.to?.scale ?? 1.08} onChange={(value) => updateTransform("to", "scale", value)} />
        </div>
      ) : null}
      {animation.type === "rotate" ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="From deg" value={animation.from?.rotation ?? layer.rotation ?? 0} onChange={(value) => updateTransform("from", "rotation", value)} />
          <NumberField label="To deg" value={animation.to?.rotation ?? (layer.rotation ?? 0) + 360} onChange={(value) => updateTransform("to", "rotation", value)} />
        </div>
      ) : null}
    </div>
  );
};

const DeviceSheet = ({
  activity,
  display,
  displayDraft,
  isRelinking,
  isUpdatingDisplay,
  logs,
  onRelink,
  onSaveDevice,
  onUpdateDisplayDraft,
  scene,
  selectedCapabilityCanvas
}: {
  activity: OwnedDelivery[];
  display: DisplayStatus;
  displayDraft: { groupName: string; name: string; positionLabel: string };
  isRelinking: boolean;
  isUpdatingDisplay: boolean;
  logs: string[];
  onRelink: (code: string) => void;
  onSaveDevice: () => void;
  onUpdateDisplayDraft: (draft: { groupName: string; name: string; positionLabel: string }) => void;
  scene: Scene;
  selectedCapabilityCanvas?: Scene["canvas"];
}) => {
  const [relinkCode, setRelinkCode] = useState("");
  const cleanRelinkCode = relinkCode.replace(/\D/g, "").slice(0, 6);

  return (
  <Sheet>
    <SheetTrigger asChild>
      <Button size="sm" variant="outline">
        <Info />
        Device
      </Button>
    </SheetTrigger>
    <SheetContent className="sm:max-w-md">
      <SheetHeader>
        <SheetTitle>{display.name ?? display.id}</SheetTitle>
        <SheetDescription>{display.id}</SheetDescription>
      </SheetHeader>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-4 px-4 pb-4">
          <div className="grid gap-3">
            <Field label="Name" htmlFor="display-name">
              <Input id="display-name" value={displayDraft.name} onChange={(event) => onUpdateDisplayDraft({ ...displayDraft, name: event.target.value })} />
            </Field>
            <Field label="Group" htmlFor="display-group">
              <Input id="display-group" value={displayDraft.groupName} onChange={(event) => onUpdateDisplayDraft({ ...displayDraft, groupName: event.target.value })} />
            </Field>
            <Field label="Position" htmlFor="display-position">
              <Input id="display-position" value={displayDraft.positionLabel} onChange={(event) => onUpdateDisplayDraft({ ...displayDraft, positionLabel: event.target.value })} />
            </Field>
            <Button disabled={isUpdatingDisplay} onClick={onSaveDevice}>
              <Save />
              Save device
            </Button>
          </div>
          <Separator />
          <div className="grid gap-3">
            <h3 className="text-sm font-medium">Relink this screen</h3>
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="TV linking code"
              value={cleanRelinkCode}
              onChange={(event) => setRelinkCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <Button
              disabled={cleanRelinkCode.length !== 6 || isRelinking}
              onClick={() => {
                onRelink(cleanRelinkCode);
                setRelinkCode("");
              }}
              variant="outline"
            >
              Relink TV
            </Button>
          </div>
          <Separator />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Heartbeat" value={display.lastHeartbeatAt ? new Date(display.lastHeartbeatAt).toLocaleString() : "never"} />
            <Stat label="Resolution" value={selectedCapabilityCanvas ? formatCanvas(selectedCapabilityCanvas) : "unknown"} />
            <Stat label="Scene canvas" value={formatCanvas(scene.canvas)} />
            <Stat label="App" value={display.appVersion ?? "unknown"} />
            <Stat label="Scene" value={`v${display.currentSceneVersion}`} />
            <Stat label="Ack" value={String(display.lastAckVersion ?? "none")} />
          </dl>
          {display.lastError ? <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{display.lastError}</p> : null}
          <Separator />
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">Delivery history</h3>
            {activity.length ? (
              activity.map((item) => (
                <div className="rounded-lg border p-2 text-sm" key={item.id}>
                  <p className="font-medium">Scene v{item.sceneVersion}</p>
                  <p className="text-xs text-muted-foreground">Delivered {new Date(item.deliveredAt).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{item.acknowledgedAt ? `Ack ${new Date(item.acknowledgedAt).toLocaleString()}` : "No ack yet"}</p>
                  {item.error ? <p className="text-xs text-destructive">{item.error}</p> : null}
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No delivery history yet.</p>
            )}
          </div>
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">Controller log</h3>
            {logs.length ? logs.map((log) => <p className="text-sm text-muted-foreground" key={log}>{log}</p>) : <p className="text-sm text-muted-foreground">No activity yet.</p>}
          </div>
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
  );
};

const Field = ({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) => (
  <div className="grid gap-2">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

const NumberField = ({ label, onChange, step = 1, value }: { label: string; onChange: (value: number) => void; step?: number; value: number }) => (
  <Field label={label} htmlFor={`number-${label}`}>
    <Input id={`number-${label}`} type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} />
  </Field>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="font-medium">{value}</dd>
  </div>
);

const formatCanvas = (canvas: Scene["canvas"]): string => `${canvas.width} x ${canvas.height}`;

const layerLabel = (layer: SceneLayer): string => {
  if (layer.name) return layer.name;
  if (layer.type === "text") return layer.text || "Text";
  if (layer.type === "image") return "Image";
  if (layer.type === "video") return "Video";
  if (layer.type === "sprite") return "Dynamic asset";
  if (layer.type === "shape") return layer.shape;
  return "Background";
};

const presetFromAnimation = (animation?: LayerAnimation): MotionPreset => {
  if (!animation) return "none";
  if (animation.type === "move") return "slide";
  if (animation.type === "scale") return "pulse";
  if (animation.type === "fade") return "fade";
  return "rotate";
};

const resizeCursor = (handle: ResizeHandle): string => {
  if (handle === "nw" || handle === "se") return "cursor-nwse-resize";
  return "cursor-nesw-resize";
};
