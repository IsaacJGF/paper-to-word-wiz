import type { DraftDigitization, DraftQuestion } from "@/lib/draft-store";
import type { PdfQueueJob } from "./types";

export async function fileToDataURL(file: File, rotateDeg: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (!rotateDeg) return resolve(dataUrl);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const rad = (rotateDeg * Math.PI) / 180;
        const sin = Math.abs(Math.sin(rad));
        const cos = Math.abs(Math.cos(rad));
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

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function sortedPages(pages: Set<number>) {
  return Array.from(pages).sort((a, b) => a - b);
}

export function samePages(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  return a.every((page, index) => page === b[index]);
}

export function chunkPages(pages: number[], size: number) {
  const chunks: number[][] = [];
  for (let index = 0; index < pages.length; index += size) chunks.push(pages.slice(index, index + size));
  return chunks;
}

export function formatPages(pages: number[]) {
  if (pages.length === 0) return "—";
  if (pages.length === 1) return String(pages[0]);
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (let index = 1; index < sorted.length; index++) {
    const page = sorted[index];
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    ranges.push(start === previous ? String(start) : `${start}–${previous}`);
    start = page;
    previous = page;
  }
  ranges.push(start === previous ? String(start) : `${start}–${previous}`);
  return ranges.join(", ");
}

export function pageInputToNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function estimateDataUrlBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.round((base64.length * 3) / 4);
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function mergeQueueJobsIntoDraft(jobs: PdfQueueJob[]): DraftDigitization {
  const completedJobs = jobs.filter((job) => job.result);
  const imageDataUrls = completedJobs.map((job) => job.result?.imageDataUrl).filter((url): url is string => Boolean(url));
  const allQuestions = completedJobs.flatMap((job, jobIndex) => {
    const draft = job.result!.draft;
    return draft.questoes.map((question, questionIndex) => withBatchMetadata(question, job.pages, jobIndex, questionIndex));
  });
  const references = uniqueNonEmpty(completedJobs.map((job) => buildReferenceText(job.result!.draft)));
  const sources = uniqueNonEmpty(completedJobs.map((job) => job.result!.draft.referencia_fonte));
  const batchSummary = completedJobs.map((job, index) => `Lote ${index + 1}: páginas ${formatPages(job.pages)}`).join("\n");

  return {
    referencia_texto: references.length === 1
      ? references[0]
      : [`Revisão em massa de PDF com ${completedJobs.length} lote${completedJobs.length === 1 ? "" : "s"}.`, batchSummary, references.length > 0 ? `\nReferências detectadas por lote:\n${references.map((ref, index) => `Referência ${index + 1}: ${ref}`).join("\n\n")}` : ""].filter(Boolean).join("\n\n"),
    referencia_fonte: sources.length === 1 ? sources[0] : "PDF digitalizado em lotes",
    imageDataUrl: imageDataUrls[0],
    imageDataUrls,
    questoes: allQuestions.length > 0 ? allQuestions : [emptyQuestion()],
  };
}

function withBatchMetadata(question: DraftQuestion, pages: number[], jobIndex: number, questionIndex: number): DraftQuestion {
  const pageLabel = `PDF páginas ${formatPages(pages)}`;
  const source = question.fonte ? `${question.fonte} · ${pageLabel}` : pageLabel;
  const originNote = `Origem: ${pageLabel}.`;
  return {
    ...question,
    numero: question.numero || `${jobIndex + 1}.${questionIndex + 1}`,
    fonte: source,
    observacoes: [question.observacoes, originNote].filter(Boolean).join("\n"),
  };
}

function buildReferenceText(draft: DraftDigitization) {
  return [draft.referencia_texto, draft.referencia_texto_apos].filter(Boolean).join("\n").trim();
}

function uniqueNonEmpty(values: Array<string | undefined | null>) {
  const seen = new Set<string>();
  const result: string[] = [];
  values.map((value) => (value ?? "").trim()).filter(Boolean).forEach((value) => {
    const key = value.replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(value);
  });
  return result;
}

function emptyQuestion(): DraftQuestion {
  return {
    numero: "",
    enunciado: "",
    alternativas: [],
    tipo: "discursiva",
    resposta: "",
    fonte: "",
    tem_equacao: false,
    tem_imagem: false,
    baixa_confianca: [],
  };
}
