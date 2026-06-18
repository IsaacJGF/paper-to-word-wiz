import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Rect = { x: number; y: number; w: number; h: number };

type Props = {
  open: boolean;
  imageUrl: string | undefined;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
  title?: string;
};

export function ImageCropDialog({ open, imageUrl, onCancel, onConfirm, title }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (open) {
      setRect(null);
      setDrag(null);
    }
  }, [open, imageUrl]);

  const getPoint = (e: React.PointerEvent) => {
    const el = containerRef.current!;
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(r.width, e.clientX - r.left)),
      y: Math.max(0, Math.min(r.height, e.clientY - r.top)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = getPoint(e);
    setDrag(p);
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = getPoint(e);
    setRect({
      x: Math.min(drag.x, p.x),
      y: Math.min(drag.y, p.y),
      w: Math.abs(p.x - drag.x),
      h: Math.abs(p.y - drag.y),
    });
  };
  const onPointerUp = () => setDrag(null);

  const confirm = () => {
    if (!rect || !imgRef.current || !imgSize || rect.w < 6 || rect.h < 6) return;
    const img = imgRef.current;
    const displayed = img.getBoundingClientRect();
    const scaleX = imgSize.w / displayed.width;
    const scaleY = imgSize.h / displayed.height;
    const sx = rect.x * scaleX;
    const sy = rect.y * scaleY;
    const sw = rect.w * scaleX;
    const sh = rect.h * scaleY;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    onConfirm(canvas.toDataURL("image/png"));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title ?? "Recortar imagem da prova"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Clique e arraste sobre a imagem para selecionar a área a recortar.
        </p>
        <div
          ref={containerRef}
          className="relative inline-block max-h-[70vh] overflow-auto border rounded-md bg-muted/30 select-none touch-none cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {imageUrl ? (
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Original"
              draggable={false}
              className="block max-w-full pointer-events-none"
              onLoad={(e) => {
                const im = e.currentTarget;
                setImgSize({ w: im.naturalWidth, h: im.naturalHeight });
              }}
            />
          ) : (
            <div className="p-8 text-sm text-muted-foreground">Imagem indisponível</div>
          )}
          {rect && (
            <div
              className="absolute border-2 border-primary bg-primary/20 pointer-events-none"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={confirm} disabled={!rect || rect.w < 6 || rect.h < 6}>Recortar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
