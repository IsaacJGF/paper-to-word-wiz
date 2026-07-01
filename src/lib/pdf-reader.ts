import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

export type PdfPageSize = {
  width: number;
  height: number;
};

export type PdfDocumentSummary = {
  fileName: string;
  fileSize: number;
  pageCount: number;
  readablePageCount: number;
  isOverPageLimit: boolean;
  firstPageSize?: PdfPageSize;
};

export type ReadPdfOptions = {
  maxPages: number;
};

let workerConfigured = false;

function configurePdfWorker() {
  if (workerConfigured) return;
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  workerConfigured = true;
}

export async function readPdfDocumentSummary(file: File, options: ReadPdfOptions): Promise<PdfDocumentSummary> {
  if (!isPdfFile(file)) {
    throw new Error("Envie um arquivo PDF válido.");
  }

  configurePdfWorker();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data,
    stopAtErrors: false,
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  try {
    let firstPageSize: PdfPageSize | undefined;
    try {
      const firstPage = await pdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1 });
      firstPageSize = {
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
      };
      firstPage.cleanup();
    } catch (error) {
      console.warn("Não foi possível ler o tamanho da primeira página do PDF:", error);
    }

    return {
      fileName: file.name,
      fileSize: file.size,
      pageCount: pdf.numPages,
      readablePageCount: Math.min(pdf.numPages, options.maxPages),
      isOverPageLimit: pdf.numPages > options.maxPages,
      firstPageSize,
    };
  } finally {
    await pdf.destroy();
  }
}

export function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  const kb = bytes / 1024;
  return `${kb.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB`;
}
