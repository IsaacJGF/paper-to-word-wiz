import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useCallback, type RefObject } from "react";
import { AlertTriangle, FileText, ImageIcon, ListOrdered, Loader2, RotateCw, ScanLine, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/AppLayout";
import { digitizeQuestion } from "@/lib/digitize.functions";
import { saveDraft } from "@/lib/draft-store";
import {
  formatFileSize,
  isPdfFile,
  pageRange,
  readPdfDocumentSummary,
  renderPdfPagesToImageDataUrl,
  type PdfDocumentSummary,
  type PdfRenderedImage,
} from "@/lib/pdf-reader";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Digitalizar questão — Digitalizador de Questões" },
      { name: "description", content: "Envie imagens ou PDF de questões e prepare o material para revisão e exportação em Word." },
    ],
  }),
  component: Page,
});

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 4;
const MAX_COMBINED_WIDTH = 1800;
const IMAGE_GAP = 36;
const MAX_PDF_SIZE = 30 * 1024 * 1024;
const MAX_PDF_PAGES = 80;
const MAX_VISIBLE_PAGE_CARDS = 48;
const MAX_PDF_RENDER_PAGES = 10;
const PDF_RENDER_SCALE = 2;
const PDF_RENDER_MAX_WIDTH = 1800;

type UploadMode = "image" | "pdf";

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
  const [mode, setMode] = useState<UploadMode>("image");
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PdfDocumentSummary | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const [selectedPdfPages, setSelectedPdfPages] = useState<Set<number>>(new Set());
  const [rangeStart, setRangeStart] = useState("1");
  const [rangeEnd, setRangeEnd] = useState("1");
  const [pdfRendering, setPdfRendering] = useState(false);
  const [pdfDigitizing, setPdfDigitizing] = useState(false);
  const [renderedPdfImage, setRenderedPdfImage] = useState<PdfRenderedImage | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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

  const handlePdfFile = useCallback(async (list: FileList | File[] | undefined | null) => {
    const file = Array.from(list ?? [])[0];
    if (!file) return;

    if (!isPdfFile(file)) {
      toast.error("Use apenas arquivo PDF.");
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      toast.error(`PDF acima de ${formatFileSize(MAX_PDF_SIZE)}. Para começar, divida o arquivo em partes menores.`);
      return;
    }

    setPdfLoading(true);
    setPdfInfo(null);
    setPdfFile(null);
    setSelectedPdfPages(new Set());
    setRenderedPdfImage(null);
    try {
      const summary = await readPdfDocumentSummary(file, { maxPages: MAX_PDF_PAGES });
      setPdfFile(file);
      setPdfInfo(summary);
      setSelectedPdfPages(new Set([1]));
      setRangeStart("1");
      setRangeEnd("1");
      if (summary.isOverPageLimit) {
        toast.warning(`PDF lido com ${summary.pageCount} páginas. Neste fluxo, vamos preparar até ${MAX_PDF_PAGES} páginas para seleção.`);
      } else {
        toast.success(`PDF lido: ${summary.pageCount} página${summary.pageCount > 1 ? "s" : ""}.`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível ler o PDF. Verifique se o arquivo não está corrompido ou protegido.");
    } finally {
      setPdfLoading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }, []);

  const removeImage = (index: number) => {
    setImages((current) => {
      const next = [...current];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
      return next;
    });
  };

  const resetImages = () => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setRotation(0);
  };

  const resetPdf = () => {
    setPdfFile(null);
    setPdfInfo(null);
    setSelectedPdfPages(new Set());
    setRangeStart("1");
    setRangeEnd("1");
    setRenderedPdfImage(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  };

  const togglePdfPage = (page: number) => {
    setRenderedPdfImage(null);
    setSelectedPdfPages((current) => {
      const next = new Set(current);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  };

  const selectPdfRange = () => {
    if (!pdfInfo) return;
    const start = pageInputToNumber(rangeStart, 1);
    const end = pageInputToNumber(rangeEnd, start);
    const pages = pageRange(start, end, pdfInfo.readablePageCount);
    setSelectedPdfPages(new Set(pages));
    setRenderedPdfImage(null);
    toast.success(`${pages.length} página${pages.length > 1 ? "s" : ""} selecionada${pages.length > 1 ? "s" : ""}.`);
  };

  const selectFirstPdfPages = () => {
    if (!pdfInfo) return;
    const pages = pageRange(1, Math.min(MAX_PDF_RENDER_PAGES, pdfInfo.readablePageCount), pdfInfo.readablePageCount);
    setSelectedPdfPages(new Set(pages));
    setRangeStart("1");
    setRangeEnd(String(pages[pages.length - 1] ?? 1));
    setRenderedPdfImage(null);
  };

  const clearPdfSelection = () => {
    setSelectedPdfPages(new Set());
    setRenderedPdfImage(null);
  };

  const renderSelectedPdfPages = async (showSuccessToast = true): Promise<PdfRenderedImage | null> => {
    if (!pdfFile || !pdfInfo) return null;
    const pages = sortedPages(selectedPdfPages).filter((page) => page <= pdfInfo.readablePageCount);
    if (pages.length === 0) {
      toast.info("Selecione ao menos uma página do PDF.");
      return null;
    }
    if (pages.length > MAX_PDF_RENDER_PAGES) {
      toast.error(`Use no máximo ${MAX_PDF_RENDER_PAGES} páginas por lote pequeno.`);
      return null;
    }

    setPdfRendering(true);
    setRenderedPdfImage(null);
    try {
      const rendered = await renderPdfPagesToImageDataUrl(pdfFile, pages, {
        scale: PDF_RENDER_SCALE,
        maxPageWidth: PDF_RENDER_MAX_WIDTH,
        imageQuality: 0.9,
      });
      setRenderedPdfImage(rendered);
      if (showSuccessToast) toast.success("Imagem do PDF gerada com sucesso.");
      return rendered;
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível renderizar as páginas selecionadas.");
      return null;
    } finally {
      setPdfRendering(false);
    }
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
      showDigitizeError(e);
    } finally {
      setLoading(false);
    }
  };

  const onDigitizePdf = async () => {
    if (!pdfFile || !pdfInfo) return;
    const pages = sortedPages(selectedPdfPages).filter((page) => page <= pdfInfo.readablePageCount);
    if (pages.length === 0) {
      toast.info("Selecione ao menos uma página do PDF.");
      return;
    }
    if (pages.length > MAX_PDF_RENDER_PAGES) {
      toast.error(`Digitalize no máximo ${MAX_PDF_RENDER_PAGES} páginas por lote pequeno.`);
      return;
    }

    setPdfDigitizing(true);
    try {
      const rendered = renderedPdfImage && samePages(renderedPdfImage.pages, pages)
        ? renderedPdfImage
        : await renderSelectedPdfPages(false);
      if (!rendered) return;

      const result = await digitizeQuestion({ data: { imageDataUrl: rendered.imageDataUrl } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      saveDraft({
        ...result.data,
        imageDataUrl: rendered.imageDataUrl,
        imageDataUrls: [rendered.imageDataUrl],
      });
      toast.success(`PDF digitalizado: página${pages.length > 1 ? "s" : ""} ${pages.join(", ")}.`);
      navigate({ to: "/revisar" });
    } catch (error) {
      console.error(error);
      showDigitizeError(error);
    } finally {
      setPdfDigitizing(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Digitalizar questão</h1>
          <p className="mt-1 text-muted-foreground">
            Envie imagens da questão ou comece a preparar a digitalização por PDF.
          </p>
        </header>

        <div className="mb-5 grid gap-2 rounded-xl border bg-card p-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("image")}
            className={`rounded-lg px-3 py-3 text-left transition ${mode === "image" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"}`}
          >
            <span className="flex items-center gap-2 font-semibold"><ImageIcon className="size-4" /> Imagens</span>
            <span className={`mt-1 block text-xs ${mode === "image" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Fluxo atual: JPG, PNG ou WEBP.</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("pdf")}
            className={`rounded-lg px-3 py-3 text-left transition ${mode === "pdf" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"}`}
          >
            <span className="flex items-center gap-2 font-semibold"><FileText className="size-4" /> PDF</span>
            <span className={`mt-1 block text-xs ${mode === "pdf" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Selecione páginas e digitalize.</span>
          </button>
        </div>

        {mode === "image" ? (
          <ImageUploadPanel
            images={images}
            loading={loading}
            rotation={rotation}
            dragOver={dragOver}
            inputRef={imageInputRef}
            onDragOverChange={setDragOver}
            onFiles={handleFiles}
            onRemoveImage={removeImage}
            onReset={resetImages}
            onRotate={() => setRotation((r) => (r + 90) % 360)}
            onDigitize={onDigitize}
          />
        ) : (
          <PdfUploadPanel
            pdfInfo={pdfInfo}
            loading={pdfLoading}
            rendering={pdfRendering}
            digitizing={pdfDigitizing}
            dragOver={pdfDragOver}
            inputRef={pdfInputRef}
            selectedPages={selectedPdfPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            renderedImage={renderedPdfImage}
            onDragOverChange={setPdfDragOver}
            onFile={handlePdfFile}
            onReset={resetPdf}
            onTogglePage={togglePdfPage}
            onRangeStartChange={setRangeStart}
            onRangeEndChange={setRangeEnd}
            onSelectRange={selectPdfRange}
            onSelectFirstPages={selectFirstPdfPages}
            onClearSelection={clearPdfSelection}
            onRenderPages={() => { void renderSelectedPdfPages(); }}
            onDigitizePdf={() => { void onDigitizePdf(); }}
          />
        )}
      </div>
    </AppLayout>
  );
}

function ImageUploadPanel({
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
  if (images.length === 0) {
    return (
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
    );
  }

  return (
    <div className="space-y-4">
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
          As imagens devem estar na sequência correta da questão: parte 1, parte 2, parte 3 e assim por diante.
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

      <div className="flex flex-col gap-2 sm:flex-row">
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
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Dica: para questões grandes, envie os prints em partes sequenciais e com boa nitidez. A ordem mostrada aqui será a ordem usada pela IA.
      </p>
    </div>
  );
}

function PdfUploadPanel({
  pdfInfo,
  loading,
  rendering,
  digitizing,
  dragOver,
  inputRef,
  selectedPages,
  rangeStart,
  rangeEnd,
  renderedImage,
  onDragOverChange,
  onFile,
  onReset,
  onTogglePage,
  onRangeStartChange,
  onRangeEndChange,
  onSelectRange,
  onSelectFirstPages,
  onClearSelection,
  onRenderPages,
  onDigitizePdf,
}: {
  pdfInfo: PdfDocumentSummary | null;
  loading: boolean;
  rendering: boolean;
  digitizing: boolean;
  dragOver: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  selectedPages: Set<number>;
  rangeStart: string;
  rangeEnd: string;
  renderedImage: PdfRenderedImage | null;
  onDragOverChange: (value: boolean) => void;
  onFile: (list: FileList | File[] | undefined | null) => void;
  onReset: () => void;
  onTogglePage: (page: number) => void;
  onRangeStartChange: (value: string) => void;
  onRangeEndChange: (value: string) => void;
  onSelectRange: () => void;
  onSelectFirstPages: () => void;
  onClearSelection: () => void;
  onRenderPages: () => void;
  onDigitizePdf: () => void;
}) {
  if (!pdfInfo) {
    return (
      <div className="space-y-4">
        <label
          onDragOver={(e) => { e.preventDefault(); onDragOverChange(true); }}
          onDragLeave={() => onDragOverChange(false)}
          onDrop={(e) => {
            e.preventDefault();
            onDragOverChange(false);
            onFile(e.dataTransfer.files);
          }}
          className={`block cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors sm:p-16 ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => onFile(e.target.files)}
          />
          {loading ? <Loader2 className="mx-auto mb-3 size-10 animate-spin text-muted-foreground" /> : <FileText className="mx-auto mb-3 size-10 text-muted-foreground" />}
          <p className="font-medium">Clique para selecionar ou arraste um PDF aqui</p>
          <p className="mt-1 text-sm text-muted-foreground">PDF · até {formatFileSize(MAX_PDF_SIZE)} · leitura inicial de até {MAX_PDF_PAGES} páginas</p>
        </label>

        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <AlertTriangle className="size-4" /> Suporte a PDF em lote pequeno
          </div>
          Neste passo, selecione até {MAX_PDF_RENDER_PAGES} páginas, gere a imagem e envie para a mesma IA usada na digitalização por imagem.
        </div>
      </div>
    );
  }

  const visiblePages = Array.from({ length: Math.min(pdfInfo.readablePageCount, MAX_VISIBLE_PAGE_CARDS) }, (_, index) => index + 1);
  const hiddenPageCount = Math.max(0, pdfInfo.readablePageCount - visiblePages.length);
  const selectedCount = selectedPages.size;
  const isBusy = rendering || digitizing;
  const canUseBatch = selectedCount > 0 && selectedCount <= MAX_PDF_RENDER_PAGES && !isBusy;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-semibold">
              <FileText className="size-5 text-primary" />
              <span className="truncate">{pdfInfo.fileName}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione uma página ou intervalo. O sistema transforma esse lote em imagem e envia para a IA atual.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onReset} disabled={isBusy}>
            <X className="size-4" /> Remover PDF
          </Button>
        </div>

        <div className="grid gap-3 border-b bg-muted/20 p-4 sm:grid-cols-4">
          <PdfMetric label="Tamanho" value={formatFileSize(pdfInfo.fileSize)} />
          <PdfMetric label="Páginas" value={String(pdfInfo.pageCount)} />
          <PdfMetric label="Preparadas" value={String(pdfInfo.readablePageCount)} />
          <PdfMetric label="Selecionadas" value={String(selectedCount)} />
        </div>

        {pdfInfo.isOverPageLimit && (
          <div className="flex gap-2 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              O PDF tem {pdfInfo.pageCount} páginas. Para não travar o navegador, este fluxo prepara até {MAX_PDF_PAGES} páginas. PDFs maiores devem ser processados por fila/lotes nos próximos PRs.
            </span>
          </div>
        )}

        <div className="border-b p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Selecionar páginas</h2>
              <p className="text-xs text-muted-foreground">Escolha páginas específicas nos cards ou selecione um intervalo. Digitalização limitada a {MAX_PDF_RENDER_PAGES} páginas por lote.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onSelectFirstPages} disabled={isBusy}>Primeiras {Math.min(MAX_PDF_RENDER_PAGES, pdfInfo.readablePageCount)}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={onClearSelection} disabled={isBusy}>Limpar</Button>
            </div>
          </div>

          <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="pdf-range-start">Página inicial</label>
              <Input id="pdf-range-start" value={rangeStart} onChange={(event) => onRangeStartChange(onlyDigits(event.target.value))} inputMode="numeric" placeholder="1" disabled={isBusy} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="pdf-range-end">Página final</label>
              <Input id="pdf-range-end" value={rangeEnd} onChange={(event) => onRangeEndChange(onlyDigits(event.target.value))} inputMode="numeric" placeholder="1" disabled={isBusy} />
            </div>
            <Button type="button" onClick={onSelectRange} disabled={isBusy}>Selecionar intervalo</Button>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Páginas detectadas</h2>
              <p className="text-xs text-muted-foreground">Clique em uma página para marcar ou desmarcar.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={!canUseBatch} variant="outline" className="gap-2" onClick={onRenderPages}>
                {rendering ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                {rendering ? "Renderizando..." : "Gerar imagem"}
              </Button>
              <Button type="button" disabled={!canUseBatch} variant="default" className="gap-2" onClick={onDigitizePdf}>
                {digitizing ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
                {digitizing ? "Digitalizando..." : "Digitalizar PDF e revisar"}
              </Button>
            </div>
          </div>

          {selectedCount > MAX_PDF_RENDER_PAGES && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              Você selecionou {selectedCount} páginas. Reduza para no máximo {MAX_PDF_RENDER_PAGES} páginas por lote pequeno.
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
            {visiblePages.map((page) => {
              const selected = selectedPages.has(page);
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => onTogglePage(page)}
                  disabled={isBusy}
                  className={`rounded-lg border p-2 text-center text-xs transition disabled:cursor-not-allowed disabled:opacity-70 ${selected ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background hover:bg-muted"}`}
                >
                  <div className={`mb-1 flex h-14 items-center justify-center rounded ${selected ? "bg-primary-foreground/15" : "bg-muted/50"}`}>
                    <FileText className="size-5" />
                  </div>
                  Página {page}
                </button>
              );
            })}
            {hiddenPageCount > 0 && (
              <div className="rounded-lg border border-dashed bg-muted/20 p-2 text-center text-xs text-muted-foreground">
                <div className="mb-1 flex h-14 items-center justify-center rounded bg-muted/50">+{hiddenPageCount}</div>
                páginas ocultas
              </div>
            )}
          </div>
        </div>
      </div>

      {renderedImage && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
            <div>
              <h2 className="font-semibold">Imagem gerada do PDF</h2>
              <p className="text-sm text-muted-foreground">
                Esta é a imagem que será enviada para a IA, reaproveitando o mesmo fluxo da digitalização por imagem.
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{renderedImage.pages.length} página{renderedImage.pages.length > 1 ? "s" : ""}</p>
              <p>{renderedImage.width}×{renderedImage.height}px</p>
              <p>{formatFileSize(estimateDataUrlBytes(renderedImage.imageDataUrl))}</p>
            </div>
          </div>
          <div className="bg-muted/20 p-4">
            <img src={renderedImage.imageDataUrl} alt="Páginas renderizadas do PDF" className="mx-auto max-h-[640px] max-w-full rounded-lg border bg-white object-contain" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4 text-sm text-muted-foreground">
            <span>Páginas renderizadas: {renderedImage.pages.join(", ")}</span>
            <Button type="button" disabled={isBusy} variant="default" className="gap-2" onClick={onDigitizePdf}>
              {digitizing ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
              {digitizing ? "Digitalizando..." : "Digitalizar e abrir revisão"}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        Este fluxo processa um lote pequeno por vez. Para PDFs longos, selecione páginas em grupos de até {MAX_PDF_RENDER_PAGES} e revise cada extração antes de salvar.
      </div>
    </div>
  );
}

function PdfMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function sortedPages(pages: Set<number>) {
  return Array.from(pages).sort((a, b) => a - b);
}

function samePages(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  return a.every((page, index) => page === b[index]);
}

function pageInputToNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

function estimateDataUrlBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.round((base64.length * 3) / 4);
}

function showDigitizeError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("LOVABLE_API_KEY")) toast.error("Digitalização por IA não configurada. Configure a chave LOVABLE_API_KEY no ambiente do projeto.");
  else if (msg.includes("429")) toast.error("Limite de IA atingido. Aguarde alguns instantes.");
  else if (msg.includes("402")) toast.error("Créditos de IA esgotados. Adicione créditos no workspace.");
  else toast.error("Falha ao digitalizar. Tente novamente.");
}
