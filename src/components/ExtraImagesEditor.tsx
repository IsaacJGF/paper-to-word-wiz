import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  ImagePlus,
  RotateCcw,
  RotateCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_REFERENCE_IMAGE_BLOCK_LAYOUT,
  normalizeImagePlacementLayout,
  type ExtraImage,
  type ExtraImagePosition,
  type ImagePlacementAlign,
  type ImagePlacementLayout,
} from "@/lib/image-layout";

type Props = {
  images: ExtraImage[];
  onChange: (images: ExtraImage[]) => void;
  onAdd: () => void;
  onReplace: (index: number) => void;
  allowBetween?: boolean;
  label?: string;
  addLabel?: string;
};

export function ExtraImagesEditor({
  images,
  onChange,
  onAdd,
  onReplace,
  allowBetween = true,
  label = "Imagens adicionais",
  addLabel = "Adicionar outra imagem",
}: Props) {
  const patch = (index: number, updater: (image: ExtraImage) => ExtraImage) => {
    onChange(images.map((image, i) => (i === index ? updater(image) : image)));
  };

  const patchLayout = (index: number, partial: Partial<ImagePlacementLayout>) => {
    patch(index, (image) => ({
      ...image,
      layout: normalizeImagePlacementLayout({
        ...DEFAULT_REFERENCE_IMAGE_BLOCK_LAYOUT,
        ...image.layout,
        ...partial,
        mode: "block",
      }),
    }));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  };

  const alignButton = (index: number, current: ImagePlacementAlign, align: ImagePlacementAlign, icon: React.ReactNode, title: string) => (
    <Button
      type="button"
      size="icon"
      variant={current === align ? "secondary" : "ghost"}
      className="size-8"
      title={title}
      onClick={() => patchLayout(index, { align })}
    >
      {icon}
    </Button>
  );

  const positions: { value: ExtraImagePosition; label: string }[] = allowBetween
    ? [{ value: "antes", label: "Antes" }, { value: "entre", label: "Entre" }, { value: "depois", label: "Depois" }]
    : [{ value: "antes", label: "Antes" }, { value: "depois", label: "Depois" }];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}{images.length > 0 ? ` (${images.length})` : ""}</Label>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1" onClick={onAdd}>
          <ImagePlus className="size-3" /> {addLabel}
        </Button>
      </div>

      {images.map((image, index) => {
        const layout = normalizeImagePlacementLayout({ ...DEFAULT_REFERENCE_IMAGE_BLOCK_LAYOUT, ...image.layout, mode: "block" });
        const alignClass = layout.align === "left" ? "justify-start" : layout.align === "right" ? "justify-end" : "justify-center";
        return (
          <div key={index} className="space-y-2 rounded-lg border bg-muted/20 p-2">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs font-medium text-muted-foreground mr-1">#{index + 1}</span>
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => onReplace(index)}>
                <ImagePlus className="size-3.5" /> Recortar / substituir
              </Button>
              <Button type="button" size="icon" variant="outline" className="size-8" title="Girar para a esquerda" onClick={() => patchLayout(index, { rotation: layout.rotation - 15 })}>
                <RotateCcw className="size-3.5" />
              </Button>
              <Button type="button" size="icon" variant="outline" className="size-8" title="Girar para a direita" onClick={() => patchLayout(index, { rotation: layout.rotation + 15 })}>
                <RotateCw className="size-3.5" />
              </Button>
              {positions.map((position) => (
                <Button
                  key={position.value}
                  type="button"
                  size="sm"
                  variant={image.pos === position.value ? "secondary" : "outline"}
                  className="h-8"
                  onClick={() => patch(index, (item) => ({ ...item, pos: position.value }))}
                >
                  {position.label}
                </Button>
              ))}
              <Button type="button" size="icon" variant="outline" className="size-8" title="Mover para cima" disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp className="size-3.5" />
              </Button>
              <Button type="button" size="icon" variant="outline" className="size-8" title="Mover para baixo" disabled={index === images.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown className="size-3.5" />
              </Button>
              <div className="ml-auto flex items-center gap-1">
                {alignButton(index, layout.align ?? "center", "left", <AlignLeft className="size-3.5" />, "Alinhar à esquerda")}
                {alignButton(index, layout.align ?? "center", "center", <AlignCenter className="size-3.5" />, "Centralizar")}
                {alignButton(index, layout.align ?? "center", "right", <AlignRight className="size-3.5" />, "Alinhar à direita")}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-destructive"
                  onClick={() => onChange(images.filter((_, i) => i !== index))}
                >
                  <X className="size-3.5" /> Remover
                </Button>
              </div>
            </div>

            <div className={`flex ${alignClass} rounded-md bg-background p-2`}>
              <div className="rounded-md border bg-card p-2 shadow-sm" style={{ width: `${layout.width}%`, minWidth: 120, maxWidth: "100%" }}>
                <img
                  src={image.url}
                  alt={`Imagem adicional ${index + 1}`}
                  className="max-h-80 w-full rounded object-contain"
                  style={{ transform: `rotate(${layout.rotation}deg)` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 px-1">
              <Label className="text-xs text-muted-foreground">Tamanho</Label>
              <input
                type="range"
                min={25}
                max={95}
                step={1}
                value={layout.width}
                onChange={(e) => patchLayout(index, { width: Number(e.target.value) })}
                className="h-2 flex-1 accent-primary"
              />
              <span className="w-10 text-right text-xs text-muted-foreground">{Math.round(layout.width)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
