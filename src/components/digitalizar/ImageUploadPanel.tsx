import type { RefObject } from "react";
import { ImageIcon, ListOrdered, Loader2, RotateCw, ScanLine, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_FILES, type SelectedImage } from "./types";

export function ImageUploadPanel({
  images,
  loading,
  rotation,
  dragOver,
  inputRef,
  onDragOverChange,
  onFiles,
  onRemoveImage,
  onReset,
  onRotate,
  onDigitize,
}: {
  images: SelectedImage[];
  loading: boolean;
  rotation: number;
  dragOver: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onDragOverChange: (value: boolean) => void;
  onFiles: (list: FileList | File[] | undefined | null) => void;
  onRemoveImage: (index: number) => void;
  onReset: () => void;
  onRotate: () => void;
  onDigitize: () => void;
}) {
  return (
    <div className="space-y-4">
      <StepBlock title="Etapa 2 — Enviar imagem" description="Selecione uma ou mais imagens da questão. O fluxo por imagem continua simples e direto.">
        {images.length === 0 ? (
          <label
            onDragOver={(e) => { e.preventDefault(); onDragOverChange(true); }}
            onDragLeave={() => onDragOverChange(false)}
            onDrop={(e) => {
              e.preventDefault();
              onDragOverChange(false);
              onFiles(e.dataTransfer.files);
            }}
            className={`block cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors sm:p-16 ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <Upload className="mx-auto mb-3 size-10 text-muted-foreground" />
            <p className="font-medium">Clique para selecionar ou arraste as imagens aqui</p>
            <p className="mt-1 text-sm text-muted-foreground">JPG · PNG · WEBP · até 10MB cada · máximo {MAX_FILES} imagens</p>
          </label>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="size-4" />
                {images.length} imagem{images.length > 1 ? "ns" : ""} selecionada{images.length > 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={onRotate}>
                  <RotateCw className="size-4" /> Girar todas
                </Button>
                <Button variant="ghost" size="sm" onClick={onReset}>
                  <X className="size-4" /> Remover tudo
                </Button>
              </div>
            </div>
            <div className="flex gap-2 border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <ListOrdered className="size-4 shrink-0" />
              Etapa 3 — Confira a sequência: parte 1, parte 2, parte 3 e assim por diante.
            </div>
            <div className="grid gap-3 bg-muted/20 p-4 sm:grid-cols-2">
              {images.map((img, index) => (
                <div key={img.preview} className="overflow-hidden rounded-lg border bg-background">
                  <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium">Parte {index + 1} de {images.length}</div>
                      <div className="truncate text-xs text-muted-foreground">{img.file.name}</div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => onRemoveImage(index)}>
                      <X className="size-3" />
                    </Button>
                  </div>
                  <div className="flex min-h-44 items-center justify-center bg-muted/20 p-2">
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
        )}
      </StepBlock>

      {images.length > 0 && (
        <StepBlock title="Etapa 4 — Processar" description="A IA vai ler as imagens na ordem mostrada e criar um rascunho para revisão.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="lg" className="flex-1 gap-2" onClick={onDigitize} disabled={loading}>
              {loading ? <><Loader2 className="size-4 animate-spin" /> Digitalizando…</> : <><ScanLine className="size-4" /> Digitalizar e revisar</>}
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
              onChange={(e) => onFiles(e.target.files)}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Etapa 5 — Depois da leitura, o sistema abre a revisão para você conferir antes de salvar.
          </p>
        </StepBlock>
      )}
    </div>
  );
}

function StepBlock({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
