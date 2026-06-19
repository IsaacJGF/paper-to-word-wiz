import { supabase } from "@/integrations/supabase/client";
import physicsCatalogSql from "../../supabase/migrations/20260619133000_seed_physics_catalog_areas.sql?raw";
import provasInstituicoesSql from "../../supabase/migrations/20260619170000_seed_catalog_provas_instituicoes.sql?raw";

type CatalogRow = {
  area: string;
  conteudo: string;
  subconteudos: string[];
};

const SEED_STORAGE_KEY = "paper-to-word-wiz.default-catalog.seeded.v1";

// O cliente Supabase tipa `from(table)` por union; aqui as tabelas sao dinamicas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

let seedPromise: Promise<void> | null = null;

export function ensureDefaultCatalog() {
  if (!seedPromise) seedPromise = seedDefaultCatalog();
  return seedPromise;
}

async function seedDefaultCatalog() {
  if (typeof window !== "undefined" && window.localStorage.getItem(SEED_STORAGE_KEY) === "done") {
    const { count, error } = await supabase
      .from("catalog_areas")
      .select("id", { count: "exact", head: true });
    if (!error && (count ?? 0) > 0) return;
  }

  const areas = linesFromBlock(physicsCatalogSql, "areas");
  const catalogRows = catalogRowsFromBlock(physicsCatalogSql, "catalog");
  const relacionados = linesFromBlock(physicsCatalogSql, "related");
  const tags = linesFromBlock(physicsCatalogSql, "tags");
  const provas = linesFromBlock(provasInstituicoesSql, "provas");
  const instituicoes = linesFromBlock(provasInstituicoesSql, "instituicoes");

  await upsertSimple("catalog_areas", areas);

  const { data: areaRows, error: areaError } = await supabase
    .from("catalog_areas")
    .select("id,nome")
    .in("nome", areas);
  if (areaError) throw areaError;

  const areaByName = new Map((areaRows ?? []).map((area) => [area.nome, area.id]));
  const conteudosPayload = catalogRows
    .map((row) => ({ nome: row.conteudo, area_id: areaByName.get(row.area), ativo: true }))
    .filter((row): row is { nome: string; area_id: string; ativo: boolean } => Boolean(row.area_id));

  if (conteudosPayload.length > 0) {
    const { error } = await db
      .from("catalog_conteudos")
      .upsert(conteudosPayload, { onConflict: "area_id,nome" });
    if (error) throw error;
  }

  const areaIds = [...areaByName.values()];
  if (areaIds.length > 0) {
    const { data: conteudoRows, error: conteudoError } = await db
      .from("catalog_conteudos")
      .select("id,nome,area_id")
      .in("area_id", areaIds);
    if (conteudoError) throw conteudoError;

    const conteudoByAreaAndName = new Map<string, string>();
    for (const conteudo of conteudoRows ?? []) {
      conteudoByAreaAndName.set(`${conteudo.area_id}::${conteudo.nome}`, conteudo.id);
    }

    const subconteudosPayload = catalogRows.flatMap((row) => {
      const areaId = areaByName.get(row.area);
      const conteudoId = areaId ? conteudoByAreaAndName.get(`${areaId}::${row.conteudo}`) : undefined;
      return conteudoId ? row.subconteudos.map((nome) => ({ nome, conteudo_id: conteudoId, ativo: true })) : [];
    });

    if (subconteudosPayload.length > 0) {
      const { error } = await db
        .from("catalog_subconteudos")
        .upsert(subconteudosPayload, { onConflict: "conteudo_id,nome" });
      if (error) throw error;
    }
  }

  await upsertSimple("catalog_relacionados", relacionados);
  await upsertSimple("catalog_tags", tags);
  await upsertSimple("catalog_provas", provas);
  await upsertSimple("catalog_instituicoes", instituicoes);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(SEED_STORAGE_KEY, "done");
  }
}

async function upsertSimple(table: string, names: readonly string[]) {
  const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (uniqueNames.length === 0) return;

  const { error } = await db
    .from(table)
    .upsert(uniqueNames.map((nome) => ({ nome, ativo: true })), { onConflict: "nome" });
  if (error) throw error;
}

function catalogRowsFromBlock(sql: string, label: string): CatalogRow[] {
  return linesFromBlock(sql, label)
    .map((line) => line.split("\t"))
    .filter((parts) => parts.length >= 3)
    .map(([area, conteudo, subconteudos]) => ({
      area: area.trim(),
      conteudo: conteudo.trim(),
      subconteudos: subconteudos.split("|").map((item) => item.trim()).filter(Boolean),
    }))
    .filter((row) => row.area && row.conteudo && row.subconteudos.length > 0);
}

function linesFromBlock(sql: string, label: string) {
  const block = dollarBlock(sql, label);
  return block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function dollarBlock(sql: string, label: string) {
  const marker = `$${label}$`;
  const start = sql.indexOf(marker);
  if (start === -1) return "";
  const contentStart = start + marker.length;
  const end = sql.indexOf(marker, contentStart);
  if (end === -1) return "";
  return sql.slice(contentStart, end);
}
