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

export type PdfRenderedImage = {
  imageDataUrl: string;
  pages: number[];
  width: number;
  height: number;
};

export type ReadPdfOptions = {
  maxPages: number;
};

export type RenderPdfPagesOptions = {
  scale?: number;
  maxPageWidth?: number;
  imageQuality?: number;
};

const PAGE_GAP = 36;
const LABEL_HEIGHT = 34;

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

  const pdf = await openPdfDocument(file);
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

export async function renderPdfPagesToImageDataUrl(
  file: File,
  pageNumbers: number[],
  options: RenderPdfPagesOptions = {},
): Promise<PdfRenderedImage> {
  if (!isPdfFile(file)) {
    throw new Error("Envie um arquivo PDF válido.");
  }

  const scale = options.scale ?? 2;
  const maxPageWidth = options.maxPageWidth ?? 1800;
  const imageQuality = options.imageQuality ?? 0.9;
  const pdf = await openPdfDocument(file);

  try {
    const pages = normalizePageNumbers(pageNumbers, pdf.numPages);
    if (pages.length === 0) {
      throw new Error("Selecione ao menos uma página do PDF.");
    }

    const renderedPages = await Promise.all(pages.map(async (pageNumber) => {
      const page = await pdf.getPage(pageNumber);
      try {
        const baseViewport = page.getViewport({ scale: 1 });
        const finalScale = Math.min(scale, maxPageWidth / baseViewport.width);
        const viewport = page.getViewport({ scale: finalScale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Não foi possível preparar o canvas para renderizar o PDF.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        return {
          pageNumber,
          canvas,
          width: canvas.width,
          height: canvas.height,
        };
      } finally {
        page.cleanup();
      }
    }));

    const labelHeight = renderedPages.length > 1 ? LABEL_HEIGHT : 0;
    const canvasWidth = Math.max(...renderedPages.map((page) => page.width));
    const canvasHeight = renderedPages.reduce(
      (sum, page, index) => sum + labelHeight + page.height + (index < renderedPages.length - 1 ? PAGE_GAP : 0),
      0,
    );
    const combinedCanvas = document.createElement("canvas");
    combinedCanvas.width = canvasWidth;
    combinedCanvas.height = canvasHeight;
    const combinedCtx = combinedCanvas.getContext("2d");
    if (!combinedCtx) throw new Error("Não foi possível combinar as páginas renderizadas.");

    combinedCtx.fillStyle = "#ffffff";
    combinedCtx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

    let y = 0;
    for (const page of renderedPages) {
      if (labelHeight) {
        combinedCtx.fillStyle = "#111827";
        combinedCtx.font = "22px Arial";
        combinedCtx.fillText(`Página ${page.pageNumber} de ${pdf.numPages}`, 12, y + 24);
        y += labelHeight;
      }
      const x = Math.round((canvasWidth - page.width) / 2);
      combinedCtx.drawImage(page.canvas, x, y, page.width, page.height);
      y += page.height + PAGE_GAP;
    }

    return {
      imageDataUrl: combinedCanvas.toDataURL("image/jpeg", imageQuality),
      pages,
      width: combinedCanvas.width,
      height: combinedCanvas.height,
    };
  } finally {
    await pdf.destroy();
  }
}

async function openPdfDocument(file: File) {
  configurePdfWorker();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data,
    stopAtErrors: false,
    isEvalSupported: false,
  });
  return loadingTask.promise;
}

function normalizePageNumbers(pageNumbers: number[], maxPages: number) {
  return Array.from(new Set(pageNumbers))
    .filter((page) => Number.isInteger(page) && page >= 1 && page <= maxPages)
    .sort((a, b) => a - b);
}

export function pageRange(start: number, end: number, maxPages: number) {
  const safeStart = Math.max(1, Math.min(maxPages, Math.floor(start)));
  const safeEnd = Math.max(1, Math.min(maxPages, Math.floor(end)));
  const from = Math.min(safeStart, safeEnd);
  const to = Math.max(safeStart, safeEnd);
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
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
