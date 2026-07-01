import { useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { digitizeQuestion } from "@/lib/digitize.functions";
import { saveDraft, type DraftDigitization, type DraftQuestion } from "@/lib/draft-store";
import { formatFileSize, isPdfFile, pageRange, readPdfDocumentSummary, renderPdfPagesToImageDataUrl, type PdfDocumentSummary, type PdfRenderedImage } from "@/lib/pdf-reader";
import { toast } from "sonner";
import { clearPdfQueueStorage, loadPdfQueue, persistPdfQueue } from "./storage";
import {
  MAX_FILES,
  MAX_PDF_PAGES,
  MAX_PDF_RENDER_PAGES,
  MAX_PDF_SIZE,
  MAX_SIZE,
  PDF_QUEUE_BATCH_SIZE,
  PDF_QUEUE_DELAY_MS,
  PDF_RENDER_MAX_WIDTH,
  PDF_RENDER_SCALE,
  type PdfQueueJob,
  type PdfQueueResult,
  type PdfQueueRunMode,
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

export function useDigitalizarController() {
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
  const [queueRunMode, setQueueRunMode] = useState<PdfQueueRunMode>("idle");
  const [queuePaused, setQueuePaused] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const pauseQueueRef = useRef(false);
  const cancelQueueRef = useRef(false);
  const queueRef = useRef<PdfQueueJob[]>(pdfQueue);
  queueRef.current = pdfQueue;

  const setAndStorePdfQueue = (updater: PdfQueueJob[] | ((current: PdfQueueJob[]) => PdfQueueJob[])) => {
    setPdfQueue((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      queueRef.current = next;
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
      if (summary.isOverPageLimit) toast.warning(`PDF lido com ${summary.pageCount} páginas. Neste fluxo, vamos preparar até ${MAX_PDF_PAGES} páginas para seleção.`);
      else if (queueRef.current.length > 0) toast.success(`PDF lido. A fila temporária foi mantida com ${queueRef.current.length} lote(s).`);
      else toast.success(`PDF lido: ${summary.pageCount} página${summary.pageCount > 1 ? "s" : ""}.`);
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

  const selectAllPreparedPdfPages = () => {
    if (!pdfInfo) return;
    const pages = pageRange(1, pdfInfo.readablePageCount, pdfInfo.readablePageCount);
    setSelectedPdfPages(new Set(pages));
    setRangeStart("1");
    setRangeEnd(String(pdfInfo.readablePageCount));
    setRenderedPdfImage(null);
    toast.success(`${pages.length} páginas preparadas selecionadas.`);
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
      const rendered = await renderPdfPagesToImageDataUrl(pdfFile, pages, { scale: PDF_RENDER_SCALE, maxPageWidth: PDF_RENDER_MAX_WIDTH, imageQuality: 0.9 });
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
      const dataUrl = images.length === 1 ? await fileToDataURL(images[0].file, rotation) : await filesToSequentialDataURL(images, rotation);
      const result = await digitizeQuestion({ data: { imageDataUrl: dataUrl } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      saveDraftAndReview({ ...result.data, imageDataUrl: dataUrl }, "Questão digitalizada!");
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
      toast.error(`Digitalize no máximo ${MAX_PDF_RENDER_PAGES} páginas por lote pequeno ou crie uma fila de lotes.`);
      return;
    }
    setPdfDigitizing(true);
    try {
      const rendered = renderedPdfImage && samePages(renderedPdfImage.pages, pages) ? renderedPdfImage : await renderSelectedPdfPages(false);
      if (!rendered) return;
      const result = await digitizeQuestion({ data: { imageDataUrl: rendered.imageDataUrl } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      saveDraftAndReview({ ...result.data, imageDataUrl: rendered.imageDataUrl, imageDataUrls: [rendered.imageDataUrl] }, `PDF digitalizado: página${pages.length > 1 ? "s" : ""} ${pages.join(", ")}.`);
    } catch (error) {
      console.error(error);
      showDigitizeError(error);
    } finally {
      setPdfDigitizing(false);
    }
  };

  const createPdfQueueFromSelection = () => {
    if (!pdfInfo) return;
    const pages = sortedPages(selectedPdfPages).filter((page) => page <= pdfInfo.readablePageCount);
    if (pages.length === 0) {
      toast.info("Selecione páginas para criar a fila.");
      return;
    }
    const batches = chunkPages(pages, PDF_QUEUE_BATCH_SIZE);
    const createdAt = Date.now();
    const jobs: PdfQueueJob[] = batches.map((batch, index) => ({ id: `${createdAt}-${index}`, pages: batch, status: "pending" }));
    setAndStorePdfQueue(jobs);
    toast.success(`Fila criada com ${jobs.length} lote${jobs.length > 1 ? "s" : ""}.`);
  };

  const clearPdfQueue = () => {
    cancelQueueRef.current = true;
    pauseQueueRef.current = false;
    setQueuePaused(false);
    setQueueRunMode("idle");
    setAndStorePdfQueue([]);
    clearPdfQueueStorage();
    toast.success("Fila de PDF limpa.");
  };

  const processNextQueueJob = () => {
    const nextJob = queueRef.current.find((job) => job.status === "pending");
    if (!nextJob) {
      toast.info("Não há lotes pendentes na fila.");
      return;
    }
    void processQueueJob(nextJob.id);
  };

  const processQueueJob = async (jobId: string) => {
    if (queueRunMode !== "idle") {
      toast.info("Já existe um processamento contínuo em andamento.");
      return;
    }
    const job = queueRef.current.find((item) => item.id === jobId);
    if (!job) return;
    await processQueueJobData(job);
  };

  const processQueueJobData = async (job: PdfQueueJob) => {
    if (!pdfFile) {
      toast.error("Envie novamente o PDF para continuar processando a fila.");
      return false;
    }
    setActiveQueueJobId(job.id);
    setAndStorePdfQueue((current) => current.map((item) => item.id === job.id ? { ...item, status: "processing", error: undefined } : item));
    try {
      const rendered = await renderPdfPagesToImageDataUrl(pdfFile, job.pages, { scale: PDF_RENDER_SCALE, maxPageWidth: PDF_RENDER_MAX_WIDTH, imageQuality: 0.9 });
      setRenderedPdfImage(rendered);
      const result = await digitizeQuestion({ data: { imageDataUrl: rendered.imageDataUrl } });
      if (!result.ok) {
        setAndStorePdfQueue((current) => current.map((item) => item.id === job.id ? { ...item, status: "error", error: result.message } : item));
        toast.error(result.message);
        return false;
      }
      const draft: DraftDigitization = { ...result.data, imageDataUrl: rendered.imageDataUrl, imageDataUrls: [rendered.imageDataUrl] };
      const queueResult: PdfQueueResult = { draft, imageDataUrl: rendered.imageDataUrl, imageSize: estimateDataUrlBytes(rendered.imageDataUrl), questionCount: draft.questoes.length, processedAt: new Date().toISOString() };
      setAndStorePdfQueue((current) => current.map((item) => item.id === job.id ? { ...item, status: "done", error: undefined, result: queueResult } : item));
      toast.success(`Lote ${formatPages(job.pages)} digitalizado e guardado temporariamente.`);
      return true;
    } catch (error) {
      console.error(error);
      setAndStorePdfQueue((current) => current.map((item) => item.id === job.id ? { ...item, status: "error", error: errorMessage(error) } : item));
      showDigitizeError(error);
      return false;
    } finally {
      setActiveQueueJobId(null);
    }
  };

  const processQueueContinuously = async (modeToRun: Exclude<PdfQueueRunMode, "idle">) => {
    if (!pdfFile) {
      toast.error("Envie novamente o PDF para continuar processando a fila.");
      return;
    }
    if (queueRunMode !== "idle" || activeQueueJobId) {
      toast.info("Já existe um processamento em andamento.");
      return;
    }
    const targetStatus = modeToRun === "pending" ? "pending" : "error";
    const initialJobs = queueRef.current.filter((job) => job.status === targetStatus);
    if (initialJobs.length === 0) {
      toast.info(modeToRun === "pending" ? "Não há lotes pendentes." : "Não há lotes com erro.");
      return;
    }
    cancelQueueRef.current = false;
    pauseQueueRef.current = false;
    setQueuePaused(false);
    setQueueRunMode(modeToRun);
    toast.success(modeToRun === "pending" ? "Processamento contínuo iniciado." : "Reprocessamento dos erros iniciado.");
    try {
      for (const plannedJob of initialJobs) {
        if (cancelQueueRef.current) break;
        while (pauseQueueRef.current && !cancelQueueRef.current) await wait(300);
        if (cancelQueueRef.current) break;
        const currentJob = queueRef.current.find((job) => job.id === plannedJob.id);
        if (!currentJob || currentJob.status !== targetStatus) continue;
        await processQueueJobData(currentJob);
        await wait(PDF_QUEUE_DELAY_MS);
      }
    } finally {
      const canceled = cancelQueueRef.current;
      cancelQueueRef.current = false;
      pauseQueueRef.current = false;
      setQueuePaused(false);
      setQueueRunMode("idle");
      toast.info(canceled ? "Processamento da fila cancelado." : "Processamento da fila finalizado.");
    }
  };

  const pauseQueueProcessing = () => {
    if (queueRunMode === "idle") return;
    pauseQueueRef.current = true;
    setQueuePaused(true);
    toast.info("Processamento pausado. O lote atual termina antes da pausa valer para o próximo.");
  };

  const resumeQueueProcessing = () => {
    pauseQueueRef.current = false;
    setQueuePaused(false);
    toast.success("Processamento retomado.");
  };

  const cancelQueueProcessing = () => {
    if (queueRunMode === "idle") return;
    cancelQueueRef.current = true;
    pauseQueueRef.current = false;
    setQueuePaused(false);
    toast.info("Cancelamento solicitado. O lote atual será finalizado e a fila vai parar.");
  };

  const openQueueJobReview = (jobId: string) => {
    const job = queueRef.current.find((item) => item.id === jobId);
    if (!job?.result) {
      toast.info("Esse lote ainda não tem resultado para revisar.");
      return;
    }
    markQueueJobsAsReviewed([jobId]);
    saveDraftAndReview(job.result.draft);
  };

  const openMassQueueReview = () => {
    const doneJobs = queueRef.current.filter((job) => job.status === "done" && job.result);
    if (doneJobs.length === 0) {
      toast.info("Processe ao menos um lote antes de abrir a revisão em massa.");
      return;
    }
    const draft = mergeQueueJobsIntoDraft(doneJobs);
    markQueueJobsAsReviewed(doneJobs.map((job) => job.id));
    saveDraftAndReview(draft, `${draft.questoes.length} item${draft.questoes.length > 1 ? "s" : ""} enviado${draft.questoes.length > 1 ? "s" : ""} para revisão em massa.`);
  };

  const markQueueJobsAsReviewed = (ids: string[]) => {
    const now = new Date().toISOString();
    setAndStorePdfQueue((current) => current.map((job) => ids.includes(job.id) ? { ...job, reviewed: true, reviewedAt: now, error: job.error ? job.error : undefined } : job));
  };

  const selectedPageCount = selectedPdfPages.size;
  const pdfDoneCount = pdfQueue.filter((job) => job.status === "done").length;
  const pdfSteps = buildPdfSteps({ hasFile: Boolean(pdfInfo), hasSelection: selectedPageCount > 0, hasQueue: pdfQueue.length > 0, hasDone: pdfDoneCount > 0, isBusy: pdfLoading || pdfRendering || pdfDigitizing || Boolean(activeQueueJobId) || queueRunMode !== "idle" });

  return {
    mode,
    setMode,
    images,
    rotation,
    loading,
    dragOver,
    imageInputRef,
    setDragOver,
    handleFiles,
    removeImage,
    resetImages,
    setRotation,
    pdfInfo,
    pdfLoading,
    pdfRendering,
    pdfDigitizing,
    pdfDragOver,
    pdfInputRef,
    selectedPdfPages,
    rangeStart,
    rangeEnd,
    renderedPdfImage,
    pdfQueue,
    activeQueueJobId,
    queueRunMode,
    queuePaused,
    pdfSteps,
    setPdfDragOver,
    handlePdfFile,
    resetPdf,
    togglePdfPage,
    setRangeStart,
    setRangeEnd,
    selectPdfRange,
    selectFirstPdfPages,
    selectAllPreparedPdfPages,
    clearPdfSelection,
    renderSelectedPdfPages,
    onDigitize,
    onDigitizePdf,
    createPdfQueueFromSelection,
    processNextQueueJob,
    processQueueContinuously,
    pauseQueueProcessing,
    resumeQueueProcessing,
    cancelQueueProcessing,
    processQueueJob,
    openQueueJobReview,
    openMassQueueReview,
    clearPdfQueue,
  };
}

function buildPdfSteps({ hasFile, hasSelection, hasQueue, hasDone, isBusy }: { hasFile: boolean; hasSelection: boolean; hasQueue: boolean; hasDone: boolean; isBusy: boolean }) {
  return [
    { label: "Origem", description: "PDF selecionado", done: true },
    { label: "Arquivo", description: hasFile ? "PDF carregado" : "Envie o PDF", done: hasFile, active: !hasFile },
    { label: "Páginas", description: hasSelection ? "Seleção pronta" : "Escolha páginas", done: hasSelection, active: hasFile && !hasSelection },
    { label: "Processar", description: hasQueue ? "Fila criada" : "Digitalize ou crie fila", done: hasQueue || hasDone, active: hasFile && hasSelection && !hasDone },
    { label: "Revisar", description: hasDone ? "Resultados prontos" : isBusy ? "Processando" : "Abra a revisão", done: hasDone, active: hasDone },
  ];
}

async function filesToSequentialDataURL(images: SelectedImage[], rotateDeg: number): Promise<string> {
  const loaded = await Promise.all(images.map(async ({ file }, index) => {
    const dataUrl = await fileToDataURL(file, rotateDeg);
    const img = await loadImage(dataUrl);
    return { img, index };
  }));
  const targetWidth = Math.min(1800, Math.max(...loaded.map(({ img }) => img.width)));
  const parts = loaded.map(({ img, index }) => {
    const scale = Math.min(1, targetWidth / img.width);
    return { img, index, width: Math.round(img.width * scale), height: Math.round(img.height * scale) };
  });
  const labelHeight = images.length > 1 ? 36 : 0;
  const canvasWidth = Math.max(...parts.map((part) => part.width));
  const canvasHeight = parts.reduce((sum, part, index) => sum + labelHeight + part.height + (index < parts.length - 1 ? 36 : 0), 0);
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
    y += part.height + 36;
  }
  return canvas.toDataURL("image/jpeg", 0.92);
}

function showDigitizeError(error: unknown) {
  const msg = errorMessage(error);
  if (msg.includes("LOVABLE_API_KEY")) toast.error("Digitalização por IA não configurada. Configure a chave LOVABLE_API_KEY no ambiente do projeto.");
  else if (msg.includes("429")) toast.error("Limite de IA atingido. Aguarde alguns instantes.");
  else if (msg.includes("402")) toast.error("Créditos de IA esgotados. Adicione créditos no workspace.");
  else toast.error("Falha ao digitalizar. Tente novamente.");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
