import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2, ScanLine, RotateCw, ImageIcon } from "lucide-react";
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

function Page() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File | undefined | null) => {
    if (!f) return;
    if (!/^image\/(jpe?g|png|webp)$/i.test(f.type)) {
      toast.error("Use JPG, JPEG, PNG ou WEBP.");
      return;
    }
    if (f.size > MAX_SIZE) {
      toast.error("Imagem acima de 10MB.");
      return;
    }
    setFile(f);
    setRotation(0);
    setPreview(URL.createObjectURL(f));
  }, []);

  const reset = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setRotation(0);
  };

  const onDigitize = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const dataUrl = await fileToDataURL(file, rotation);
      const result = await digitizeQuestion({ data: { imageDataUrl: dataUrl } });
      saveDraft({ ...result, imageDataUrl: dataUrl });
      toast.success("Questão digitalizada!");
      navigate({ to: "/revisar" });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("429")) toast.error("Limite de IA atingido. Aguarde alguns instantes.");
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
            Envie uma imagem da questão (JPG, PNG ou WEBP). A IA vai extrair enunciado, alternativas e equações.
          </p>
        </header>

        {!preview ? (
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`block cursor-pointer rounded-xl border-2 border-dashed p-10 sm:p-16 text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Upload className="mx-auto size-10 text-muted-foreground mb-3" />
            <p className="font-medium">Clique para selecionar ou arraste a imagem aqui</p>
            <p className="text-sm text-muted-foreground mt-1">JPG · PNG · WEBP · até 10MB</p>
          </label>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ImageIcon className="size-4" />
                  {file?.name}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setRotation((r) => (r + 90) % 360)}>
                    <RotateCw className="size-4" /> Girar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={reset}>
                    <X className="size-4" /> Remover
                  </Button>
                </div>
              </div>
              <div className="p-4 bg-muted/30 flex items-center justify-center min-h-[300px]">
                <img
                  src={preview}
                  alt="Pré-visualização"
                  className="max-h-[60vh] max-w-full object-contain transition-transform"
                  style={{ transform: `rotate(${rotation}deg)` }}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button size="lg" className="flex-1 gap-2" onClick={onDigitize} disabled={loading}>
                {loading ? <><Loader2 className="size-4 animate-spin" /> Digitalizando…</> : <><ScanLine className="size-4" /> Digitalizar questão</>}
              </Button>
              <Button size="lg" variant="outline" onClick={() => inputRef.current?.click()}>
                Substituir imagem
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Dica: enquadre apenas a questão para um resultado mais preciso. A IA não inventa texto ilegível — trechos duvidosos serão destacados na revisão.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
