import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2, ScanLine, RotateCw, ImageIcon, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { digitizeQuestion } from "@/lib/digitize.functions";
import { saveDraft } from "@/lib/draft-store";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Digitalizar questão — Digitalizador de Questões" },
      { name: "description", content: "Envie a imagem de uma questão e converta em texto editável com IA, prontinho para exportar em Word." },
    ],
  }),
  component: Page,
});

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 4;
const MAX_COMBINED_WIDTH = 1800;
const IMAGE_GAP = 36;

type SelectedImage = {
  file: File;
  preview: string;
};

async function fileToDataURL(file: File, rotateDeg: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (!rotateDeg) return resolve(dataUrl);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const rad = (rotateDeg * Math.PI) / 180;
        const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
        canvas.width = img.width * cos + img.height * sin;
        canvas.height = img.width * sin + img.height * cos;
        const ctx = canvas.getContext("2d")!;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function filesToSequentialDataURL(images: SelectedImage[], rotateDeg: number): Promise<string> {
  const loaded = await Promise.all(images.map(async ({ file }, index) => {
    const dataUrl = await fileToDataURL(file, rotateDeg);
    const img = await loadImage(dataUrl);
    return { img, index };
  }));

  const targetWidth = Math.min(MAX_COMBINED_WIDTH, Math.max(...loaded.map(({ img }) => img.width)));
  const parts = loaded.map(({ img, index }) => {
    const scale = Math.min(1, targetWidth / img.width);
    return {
      img,
      index,
      width: Math.round(img.width * scale),
      height: Math.round(img.height * scale),
    };
  });
  const labelHeight = images.length > 1 ? 36 : 0;
  const canvasWidth = Math.max(...parts.map((part) => part.width));
  const canvasHeight = parts.reduce((sum, part, index) => sum + labelHeight + part.height + (index < parts.length - 1 ? IMAGE_GAP : 0), 0);
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = 0;
  for (const part of parts) {
    if (labelHeight) {
      ctx.fillStyle = "#111827";
      ctx.font = "24px Arial";
      ctx.fillText(`Parte ${part.index + 1} de ${parts.length}`, 12, y + 26);
      y += labelHeight;
    }
    const x = Math.round((canvasWidth - part.width) / 2);
    ctx.drawImage(part.img, x, y, part.width, part.height);
    y += part.height + IMAGE_GAP;
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function Page() {
  const navigate = useNavigate();
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((list: FileList | File[] | undefined | null) => {
    const incoming = Array.from(list ?? []);
    if (incoming.length === 0) return;

    const valid: SelectedImage[] = [];
    for (const f of incoming) {
      if (!/^image\/(jpe?g|png|webp)$/i.test(f.type)) {
        toast.error("Use apenas JPG, JPEG, PNG ou WEBP.");
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast.error(`Imagem acima de 10MB: ${f.name}`);
        continue;
      }
      valid.push({ file: f, preview: URL.createObjectURL(f) });
    }

    if (valid.length === 0) return;
    setImages((current) => {
      const room = MAX_FILES - current.length;
      if (room <= 0) {
        valid.forEach((img) => URL.revokeObjectURL(img.preview));
        toast.error(`Você pode enviar no máximo ${MAX_FILES} imagens por digitalização.`);
        return current;
      }
      const accepted = valid.slice(0, room);
      valid.slice(room).forEach((img) => URL.revokeObjectURL(img.preview));
      if (valid.length > room) toast.warning(`Adicionei apenas ${room} imagem(ns), respeitando o limite de ${MAX_FILES}.`);
      return [...current, ...accepted];
    });
    setRotation(0);
  }, []);

  const removeImage = (index: number) => {
    setImages((current) => {
      const next = [...current];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
      return next;
    });
  };

  const reset = () => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setRotation(0);
  };

  const onDigitize = async () => {
    if (images.length === 0) return;
    setLoading(true);
    try {
      const dataUrl = images.length === 1
        ? await fileToDataURL(images[0].file, rotation)
        : await filesToSequentialDataURL(images, rotation);
      const result = await digitizeQuestion({ data: { imageDataUrl: dataUrl } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      saveDraft({ ...result.data, imageDataUrl: dataUrl });
      toast.success("Questão digitalizada!");
      navigate({ to: "/revisar" });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("LOVABLE_API_KEY")) toast.error("Digitalização por IA não configurada. Configure a chave LOVABLE_API_KEY no ambiente do projeto.");
      else if (msg.includes("429")) toast.error("Limite de IA atingido. Aguarde alguns instantes.");
      else if (msg.includes("402")) toast.error("Créditos de IA esgotados. Adicione créditos no workspace.");
      else toast.error("Falha ao digitalizar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Digitalizar questão</h1>
          <p className="text-muted-foreground mt-1">
            Envie uma ou mais imagens da questão (JPG, PNG ou WEBP). A IA vai extrair enunciado, alternativas e equações.
          </p>
        </header>

        {images.length === 0 ? (
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`block cursor-pointer rounded-xl border-2 border-dashed p-10 sm:p-16 text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Upload className="mx-auto size-10 text-muted-foreground mb-3" />
            <p className="font-medium">Clique para selecionar ou arraste as imagens aqui</p>
            <p className="text-sm text-muted-foreground mt-1">JPG · PNG · WEBP · até 10MB cada · máximo {MAX_FILES} imagens</p>
          </label>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ImageIcon className="size-4" />
                  {images.length} imagem{images.length > 1 ? "ns" : ""} selecionada{images.length > 1 ? "s" : ""}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setRotation((r) => (r + 90) % 360)}>
                    <RotateCw className="size-4" /> Girar todas
                  </Button>
                  <Button variant="ghost" size="sm" onClick={reset}>
                    <X className="size-4" /> Remover tudo
                  </Button>
                </div>
              </div>
              <div className="border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex gap-2">
                <ListOrdered className="size-4 shrink-0" />
                As imagens devem estar na sequência correta da questão: parte 1, parte 2, parte 3 e assim por diante.
              </div>
              <div className="p-4 bg-muted/20 grid gap-3 sm:grid-cols-2">
                {images.map((img, index) => (
                  <div key={img.preview} className="rounded-lg border bg-background overflow-hidden">
                    <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-xs font-medium">Parte {index + 1} de {images.length}</div>
                        <div className="truncate text-xs text-muted-foreground">{img.file.name}</div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => removeImage(index)}>
                        <X className="size-3" />
                      </Button>
                    </div>
                    <div className="flex min-h-44 items-center justify-center p-2 bg-muted/20">
                      <img
                        src={img.preview}
                        alt={`Parte ${index + 1}`}
                        className="max-h-56 max-w-full object-contain transition-transform"
                        style={{ transform: `rotate(${rotation}deg)` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button size="lg" className="flex-1 gap-2" onClick={onDigitize} disabled={loading}>
                {loading ? <><Loader2 className="size-4 animate-spin" /> Digitalizando…</> : <><ScanLine className="size-4" /> Digitalizar questão</>}
              </Button>
              <Button size="lg" variant="outline" onClick={() => inputRef.current?.click()} disabled={images.length >= MAX_FILES}>
                Adicionar imagem
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Dica: para questões grandes, envie os prints em partes sequenciais e com boa nitidez. A ordem mostrada aqui será a ordem usada pela IA.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
