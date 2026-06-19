import { useRef, useState } from "react";
import type { ImagePlacementLayout } from "@/lib/image-layout";
import { normalizeImagePlacementLayout } from "@/lib/image-layout";

type Handle = "nw" | "ne" | "sw" | "se";
type DragAction =
  | { type: "move"; pointerX: number; pointerY: number; start: ImagePlacementLayout }
  | { type: "resize"; handle: Handle; pointerX: number; pointerY: number; start: ImagePlacementLayout }
  | { type: "rotate"; startAngle: number; start: ImagePlacementLayout };

type Props = {
  imageUrl: string;
  layout?: Partial<ImagePlacementLayout> | null;
  text?: string;
  placeholder?: string;
  onLayoutChange: (layout: ImagePlacementLayout) => void;
};

const MIN_WIDTH = 8;
const MIN_HEIGHT = 8;

export function ImageLayoutEditor({ imageUrl, layout, text, placeholder, onLayoutChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(true);
  const [action, setAction] = useState<DragAction | null>(null);
  const current = normalizeImagePlacementLayout(layout);
  const previewText = text?.trim() || placeholder || "";

  const beginDrag = (event: React.PointerEvent, nextAction: DragAction) => {
    event.preventDefault();
    event.stopPropagation();
    setSelected(true);
    setAction(nextAction);
    boxRef.current?.setPointerCapture(event.pointerId);
  };

  const onMove = (event: React.PointerEvent) => {
    if (!action || !containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();

    if (action.type === "rotate") {
      const angle = pointerAngle(event.clientX, event.clientY, bounds, action.start);
      onLayoutChange(normalizeImagePlacementLayout({
        ...action.start,
        rotation: action.start.rotation + angle - action.startAngle,
      }));
      return;
    }

    const dx = ((event.clientX - action.pointerX) / bounds.width) * 100;
    const dy = ((event.clientY - action.pointerY) / bounds.height) * 100;

    if (action.type === "move") {
      onLayoutChange(normalizeImagePlacementLayout({
        ...action.start,
        x: action.start.x + dx,
        y: action.start.y + dy,
      }));
      return;
    }

    onLayoutChange(resizeFromHandle(action.start, action.handle, dx, dy));
  };

  const endDrag = (event: React.PointerEvent) => {
    setAction(null);
    try { boxRef.current?.releasePointerCapture(event.pointerId); } catch {}
  };

  const beginRotate = (event: React.PointerEvent) => {
    if (!containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    beginDrag(event, {
      type: "rotate",
      startAngle: pointerAngle(event.clientX, event.clientY, bounds, current),
      start: current,
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative min-h-[300px] overflow-hidden rounded-lg border bg-background select-none touch-none"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) setSelected(false);
      }}
    >
      <div className="absolute inset-0 p-3 text-sm leading-7 text-foreground/70 whitespace-pre-wrap pointer-events-none">
        {previewText}
      </div>
      <div
        ref={boxRef}
        className={`absolute ${selected ? "ring-2 ring-primary ring-offset-2" : "ring-1 ring-border"} bg-background/80 shadow-sm cursor-move`}
        style={{
          left: `${current.x}%`,
          top: `${current.y}%`,
          width: `${current.width}%`,
          height: `${current.height}%`,
          transform: `rotate(${current.rotation}deg)`,
          transformOrigin: "center center",
        }}
        onClick={(event) => { event.stopPropagation(); setSelected(true); }}
        onPointerDown={(event) => beginDrag(event, { type: "move", pointerX: event.clientX, pointerY: event.clientY, start: current })}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <img src={imageUrl} alt="Imagem posicionável" draggable={false} className="h-full w-full object-fill pointer-events-none" />
        {selected && (
          <>
            <button
              type="button"
              aria-label="Rotacionar imagem"
              className="absolute left-1/2 top-[-28px] size-4 -translate-x-1/2 rounded-full border border-primary bg-background shadow cursor-grab active:cursor-grabbing"
              onPointerDown={beginRotate}
            />
            {(["nw", "ne", "sw", "se"] as Handle[]).map((handle) => (
              <button
                key={handle}
                type="button"
                aria-label="Redimensionar imagem"
                className={`absolute size-3 rounded-sm border border-primary bg-background shadow ${handle.includes("n") ? "top-[-6px]" : "bottom-[-6px]"} ${handle.includes("w") ? "left-[-6px]" : "right-[-6px]"} ${handle === "nw" || handle === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize"}`}
                onPointerDown={(event) => beginDrag(event, { type: "resize", handle, pointerX: event.clientX, pointerY: event.clientY, start: current })}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function resizeFromHandle(start: ImagePlacementLayout, handle: Handle, dx: number, dy: number) {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (handle.includes("e")) right = clamp(start.x + start.width + dx, start.x + MIN_WIDTH, 100);
  if (handle.includes("w")) left = clamp(start.x + dx, 0, start.x + start.width - MIN_WIDTH);
  if (handle.includes("s")) bottom = clamp(start.y + start.height + dy, start.y + MIN_HEIGHT, 100);
  if (handle.includes("n")) top = clamp(start.y + dy, 0, start.y + start.height - MIN_HEIGHT);

  return normalizeImagePlacementLayout({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    rotation: start.rotation,
  });
}

function pointerAngle(clientX: number, clientY: number, bounds: DOMRect, layout: ImagePlacementLayout) {
  const centerX = bounds.left + bounds.width * ((layout.x + layout.width / 2) / 100);
  const centerY = bounds.top + bounds.height * ((layout.y + layout.height / 2) / 100);
  return (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
