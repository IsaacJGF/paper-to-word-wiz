import { supabase } from "@/integrations/supabase/client";
import type { ImagePlacementLayout } from "@/lib/image-layout";

export type QuestionInsertRow = Record<string, unknown>;

export type DocumentQuestion = {
  id: string;
  numero: string | null;
  enunciado: string;
  alternativas: { letra: string; texto: string; imagem?: string | null }[];
  resposta: string | null;
  fonte: string | null;
  referencia_texto: string | null;
  referencia_fonte: string | null;
  grupo_id: string | null;
  referencia_imagem: string | null;
  referencia_imagem_pos: string | null;
  referencia_imagem_layout: ImagePlacementLayout | null;
  referencia_texto_apos: string | null;
  enunciado_imagem: string | null;
  enunciado_imagem_pos: string | null;
  enunciado_imagem_layout: ImagePlacementLayout | null;
};

const OPTIONAL_INSERT_COLUMNS = [
  "referencia_imagem",
  "referencia_imagem_pos",
  "referencia_imagem_layout",
  "referencia_texto_apos",
  "enunciado_imagem",
  "enunciado_imagem_pos",
  "enunciado_imagem_layout",
  "area_geral",
  "conteudo_principal",
  "subconteudo_principal",
  "conteudos_relacionados",
  "tags_livres",
  "referencia_texto",
  "referencia_fonte",
  "grupo_id",
  "imagem_original_url",
  "ano",
  "prova",
  "instituicao",
  "observacoes",
  "disciplina",
  "conteudo",
  "dificuldade",
  "tags",
] as const;

const DOCUMENT_SELECT_COLUMNS = [
  "id",
  "numero",
  "enunciado",
  "alternativas",
  "resposta",
  "fonte",
  "referencia_texto",
  "referencia_fonte",
  "grupo_id",
  "referencia_imagem",
  "referencia_imagem_pos",
  "referencia_imagem_layout",
  "referencia_texto_apos",
  "enunciado_imagem",
  "enunciado_imagem_pos",
  "enunciado_imagem_layout",
] as const;

const REQUIRED_DOCUMENT_COLUMNS = [
  "id",
  "numero",
  "enunciado",
  "alternativas",
  "resposta",
  "fonte",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function insertQuestionsWithCompatibility(rows: QuestionInsertRow[]) {
  let currentRows = rows;
  const removedColumns: string[] = [];
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= OPTIONAL_INSERT_COLUMNS.length; attempt++) {
    const { error } = await db.from("questions").insert(currentRows);
    if (!error) return { removedColumns };

    lastError = error;
    const missingColumn = findMissingColumn(error, currentRows[0]);
    if (!missingColumn || removedColumns.includes(missingColumn)) break;

    removedColumns.push(missingColumn);
    currentRows = currentRows.map((row) => omitColumn(row, missingColumn));
  }

  throw lastError;
}

export async function fetchDocumentQuestions(ids: string[]): Promise<DocumentQuestion[]> {
  let columns = [...DOCUMENT_SELECT_COLUMNS];
  const removedColumns = new Set<string>();
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= DOCUMENT_SELECT_COLUMNS.length; attempt++) {
    const { data, error } = await db
      .from("questions")
      .select(columns.join(", "))
      .in("id", ids);

    if (!error) return normalizeDocumentRows(data ?? []);
    lastError = error;

    const missingColumn = findMissingColumn(error, columnRecord(columns));
    if (
      !missingColumn ||
      isRequiredDocumentColumn(missingColumn) ||
      removedColumns.has(missingColumn)
    ) {
      break;
    }

    removedColumns.add(missingColumn);
    columns = columns.filter((column) => column !== missingColumn);
  }

  throw lastError;
}

function normalizeDocumentRows(rows: unknown[]): DocumentQuestion[] {
  return (rows as Partial<DocumentQuestion>[]).map((row) => ({
    id: String(row.id),
    numero: row.numero ?? null,
    enunciado: row.enunciado ?? "",
    alternativas: Array.isArray(row.alternativas) ? normalizeAlternatives(row.alternativas) : [],
    resposta: row.resposta ?? null,
    fonte: row.fonte ?? null,
    referencia_texto: row.referencia_texto ?? null,
    referencia_fonte: row.referencia_fonte ?? null,
    grupo_id: row.grupo_id ?? null,
    referencia_imagem: row.referencia_imagem ?? null,
    referencia_imagem_pos: row.referencia_imagem_pos ?? null,
    referencia_imagem_layout: row.referencia_imagem_layout ?? null,
    referencia_texto_apos: row.referencia_texto_apos ?? null,
    enunciado_imagem: row.enunciado_imagem ?? null,
    enunciado_imagem_pos: row.enunciado_imagem_pos ?? null,
    enunciado_imagem_layout: row.enunciado_imagem_layout ?? null,
  }));
}

function normalizeAlternatives(value: unknown[]) {
  return value.map((item) => {
    const alt = item as { letra?: unknown; texto?: unknown; imagem?: unknown };
    return {
      letra: typeof alt.letra === "string" ? alt.letra : "",
      texto: typeof alt.texto === "string" ? alt.texto : "",
      imagem: typeof alt.imagem === "string" ? alt.imagem : null,
    };
  });
}

function omitColumn(row: QuestionInsertRow, column: string): QuestionInsertRow {
  const { [column]: _removed, ...rest } = row;
  return rest;
}

function findMissingColumn(error: unknown, sampleRow?: QuestionInsertRow) {
  const text = errorText(error);
  const candidates = Object.keys(sampleRow ?? {});
  for (const column of candidates) {
    if (text.includes(column.toLowerCase())) return column;
  }
  for (const column of OPTIONAL_INSERT_COLUMNS) {
    if (text.includes(column.toLowerCase())) return column;
  }
  return null;
}

function columnRecord(columns: readonly string[]) {
  return Object.fromEntries(columns.map((column) => [column, true]));
}

function isRequiredDocumentColumn(column: string) {
  return (REQUIRED_DOCUMENT_COLUMNS as readonly string[]).includes(column);
}

function errorText(error: unknown) {
  const err = error as { code?: string; message?: string; details?: string; hint?: string };
  return [err.code, err.message, err.details, err.hint].filter(Boolean).join(" ").toLowerCase();
}
