import { PDF_QUEUE_KEY, type PdfQueueJob } from "./types";

export function persistPdfQueue(queue: PdfQueueJob[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PDF_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.warn("Não foi possível guardar a fila temporária do PDF:", error);
  }
}

export function loadPdfQueue(): PdfQueueJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(PDF_QUEUE_KEY);
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
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem(PDF_QUEUE_KEY); } catch {}
}
