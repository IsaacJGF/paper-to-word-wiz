import { supabase } from "@/integrations/supabase/client";

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
  referencia_texto_apos: string | null;
  enunciado_imagem: string | null;
  enunciado_imagem_pos: string | null;
};

const OPTIONAL_INSERT_COLUMNS = [
  "referencia_imagem",
  "referencia_imagem_pos",
  "referencia_texto_apos",
  "enunciado_imagem",
  "enunciado_imagem_pos",
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

const DOCUMENT_FULL_SELECT = [
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
  "referencia_texto_apos",
  "enunciado_imagem",
  "enunciado_imagem_pos",
].join(", ");

const DOCUMENT_LEGACY_SELECT = [
  "id",
  "numero",
  "enunciado",
  "alternativas",
  "resposta",
  "fonte",
  "referencia_texto",
  "referencia_fonte",
  "grupo_id",
  "enunciado_imagem",
  "enunciado_imagem_pos",
].join(", ");

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
  const { data, error } = await supabase
    .from("questions")
    .select(DOCUMENT_FULL_SELECT)
    .in("id", ids);

  if (!error) return normalizeDocumentRows(data ?? []);
  if (!isMissingColumnError(error)) throw error;

  const { data: legacyData, error: legacyError } = await supabase
    .from("questions")
    .select(DOCUMENT_LEGACY_SELECT)
    .in("id", ids);
  if (legacyError) throw legacyError;

  return normalizeDocumentRows(legacyData ?? []);
}

function normalizeDocumentRows(rows: unknown[]): DocumentQuestion[] {
  return (rows as Partial<DocumentQuestion>[]).map((row) => ({
    id: String(row.id),
    numero: row.numero ?? null,
    enunciado: row.enunciado ?? "",
    alternativas: Array.isArray(row.alternativas) ? row.alternativas : [],
    resposta: row.resposta ?? null,
    fonte: row.fonte ?? null,
    referencia_texto: row.referencia_texto ?? null,
    referencia_fonte: row.referencia_fonte ?? null,
    grupo_id: row.grupo_id ?? null,
    referencia_imagem: row.referencia_imagem ?? null,
    referencia_imagem_pos: row.referencia_imagem_pos ?? null,
    referencia_texto_apos: row.referencia_texto_apos ?? null,
    enunciado_imagem: row.enunciado_imagem ?? null,
    enunciado_imagem_pos: row.enunciado_imagem_pos ?? null,
  }));
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

function isMissingColumnError(error: unknown) {
  return Boolean(findMissingColumn(error));
}

function errorText(error: unknown) {
  const err = error as { code?: string; message?: string; details?: string; hint?: string };
  return [err.code, err.message, err.details, err.hint].filter(Boolean).join(" ").toLowerCase();
}
