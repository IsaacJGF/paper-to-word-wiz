import { PDF_QUEUE_KEY, type PdfQueueJob } from "./types";

const PDF_FILE_META_KEY = "digitalizador.pdfMeta";

export type PdfFileMeta = {
  fileName: string;
  fileSize: number;
  pageCount: number;
};

// Use localStorage so a fila sobrevive a navegações, refresh e fechamento de aba.
function safeStorage() {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
}

export function persistPdfQueue(queue: PdfQueueJob[]) {
  const store = safeStorage();
  if (!store) return;
  try {
    store.setItem(PDF_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    try {
      store.setItem(PDF_QUEUE_KEY, JSON.stringify(compactPdfQueue(queue)));
    } catch (compactError) {
      console.warn("Não foi possível guardar a fila do PDF:", compactError || error);
    }
  }
}

export function loadPdfQueue(): PdfQueueJob[] {
  const store = safeStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(PDF_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PdfQueueJob[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((job) => Array.isArray(job.pages) && job.pages.length > 0 && ["pending", "processing", "done", "error"].includes(job.status))
      .map((job) => job.status === "processing" ? { ...job, status: "pending" } : job);
  } catch {
    return [];
  }
}

export function clearPdfQueueStorage() {
  const store = safeStorage();
  if (!store) return;
  try {
    store.removeItem(PDF_QUEUE_KEY);
    store.removeItem(PDF_FILE_META_KEY);
  } catch {}
}

export function persistPdfFileMeta(meta: PdfFileMeta) {
  const store = safeStorage();
  if (!store) return;
  try { store.setItem(PDF_FILE_META_KEY, JSON.stringify(meta)); } catch {}
}

export function loadPdfFileMeta(): PdfFileMeta | null {
  const store = safeStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(PDF_FILE_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PdfFileMeta;
    if (!parsed?.fileName || typeof parsed.fileSize !== "number") return null;
    return parsed;
  } catch { return null; }
}

export function isSamePdfFile(a: PdfFileMeta | null, b: PdfFileMeta | null) {
  if (!a || !b) return false;
  return a.fileName === b.fileName && a.fileSize === b.fileSize && a.pageCount === b.pageCount;
}

function compactPdfQueue(queue: PdfQueueJob[]): PdfQueueJob[] {
  return queue.map((job) => {
    if (!job.result) return job;
    return {
      ...job,
      result: {
        ...job.result,
        imageDataUrl: "",
        draft: {
          ...job.result.draft,
          imageDataUrl: undefined,
          imageDataUrls: undefined,
          referencia_imagem: compactImage(job.result.draft.referencia_imagem),
          questoes: job.result.draft.questoes.map((question) => ({
            ...question,
            enunciado_imagem: compactImage(question.enunciado_imagem),
            alternativas: question.alternativas.map((alternativa) => ({
              ...alternativa,
              imagem: compactImage(alternativa.imagem),
            })),
          })),
        },
      },
    };
  });
}

function compactImage(value?: string | null) {
  return value?.startsWith("data:image") ? undefined : value;
}
