import { useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { FileText, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { digitizeQuestion } from "@/lib/digitize.functions";
import { saveDraft, type DraftDigitization, type DraftQuestion } from "@/lib/draft-store";
import { formatFileSize, isPdfFile, pageRange, readPdfDocumentSummary, renderPdfPagesToImageDataUrl, type PdfDocumentSummary, type PdfRenderedImage } from "@/lib/pdf-reader";
import { toast } from "sonner";
import { ImageUploadPanel } from "./ImageUploadPanel";
import { PdfUploadPanel } from "./PdfUploadPanel";
import { clearPdfQueueStorage, loadPdfQueue, persistPdfQueue } from "./storage";
import {
  MAX_FILES,
  MAX_PDF_PAGES,
  MAX_PDF_RENDER_PAGES,
  MAX_PDF_SIZE,
  MAX_SIZE,
  PDF_RENDER_MAX_WIDTH,
  PDF_RENDER_SCALE,
  type PdfQueueJob,
  type PdfQueueResult,
  type SelectedImage,
  type UploadMode,
} from "./types";
import {
  chunkPages,
  errorMessage,
  estimateDataUrlBytes,
  fileToDataURL,
  formatPages,
  loadImage,
  mergeQueueJobsIntoDraft,
  pageInputToNumber,
  samePages,
  sortedPages,
} from "./utils";

export function DigitalizarPage() {
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
  const [pdfQueue, setPdfQueue] = useState<PdfQueueJob[]>(() => loadPdfQueue());
  const [activeQueueJobId, setActiveQueueJobId] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const setAndStorePdfQueue = (updater: PdfQueueJob[] | ((current: PdfQueueJob[]) => PdfQueueJob[])) => {
    setPdfQueue((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      persistPdfQueue(next);
      return next;
    });
  };

  const saveDraftAndReview = (draft: DraftDigitization | DraftQuestion, successMessage?: string) => {
    const saved = saveDraft(draft);
    if (!saved) {
      toast.error("Não foi possível preparar a revisão. Tente reduzir o lote ou revisar menos páginas por vez.");
      return;
    }
    if (successMessage) toast.success(successMessage);
    navigate({ to: "/revisar" });
  };

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

  return <div />;
}
