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
  prova: string | null;
  instituicao: string | null;
  ano: string | null;
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
  "prova",
  "instituicao",
  "ano",
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
    numero: normalizeNullableString(row.numero),
    enunciado: normalizeString(row.enunciado),
    alternativas: Array.isArray(row.alternativas) ? normalizeAlternatives(row.alternativas) : [],
    resposta: normalizeNullableString(row.resposta),
    fonte: normalizeNullableString(row.fonte),
    referencia_texto: normalizeNullableString(row.referencia_texto),
    referencia_fonte: normalizeNullableString(row.referencia_fonte),
    grupo_id: normalizeNullableString(row.grupo_id),
    referencia_imagem: normalizeNullableString(row.referencia_imagem),
    referencia_imagem_pos: normalizeNullableString(row.referencia_imagem_pos),
    referencia_imagem_layout: normalizeLayout(row.referencia_imagem_layout),
    referencia_texto_apos: normalizeNullableString(row.referencia_texto_apos),
    enunciado_imagem: normalizeNullableString(row.enunciado_imagem),
    enunciado_imagem_pos: normalizeNullableString(row.enunciado_imagem_pos),
    enunciado_imagem_layout: normalizeLayout(row.enunciado_imagem_layout),
    prova: normalizeNullableString(row.prova),
    instituicao: normalizeNullableString(row.instituicao),
    ano: normalizeNullableString(row.ano),
  }));
}

function normalizeAlternatives(value: unknown[]) {
  return value.map((item) => {
    const alt = item as { letra?: unknown; texto?: unknown; imagem?: unknown };
    return {
      letra: normalizeString(alt.letra),
      texto: normalizeString(alt.texto),
      imagem: normalizeNullableString(alt.imagem),
    };
  });
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value == null) return null;
  return String(value);
}

function normalizeLayout(value: unknown): ImagePlacementLayout | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ImagePlacementLayout : null;
}

function omitColumn(row: QuestionInsertRow, column: string): QuestionInsertRow {
  const { [column]: _removed, ...rest } = row;
  return rest;
}

function findMissingColumn(error: unknown, sampleRow?: QuestionInsertRow) {
  const text = errorText(error);
  const candidates = [
    ...Object.keys(sampleRow ?? {}),
    ...OPTIONAL_INSERT_COLUMNS,
  ];
  // Longest names first so 'enunciado_imagem_layout' wins over 'enunciado_imagem'.
  const sorted = Array.from(new Set(candidates)).sort((a, b) => b.length - a.length);
  for (const column of sorted) {
    const re = new RegExp(`(^|[^a-z0-9_])${column.toLowerCase()}([^a-z0-9_]|$)`);
    if (re.test(text)) return column;
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
