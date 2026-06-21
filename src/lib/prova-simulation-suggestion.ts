import type { FrequencyRow, ProvaAnalysisSummary, TermFrequencyRow } from "@/lib/prova-analysis";

export type SimulationAllocationRow = {
  label: string;
  suggestedCount: number;
  sourceCount: number;
  percent: number;
  years?: string[];
};

export type SimulationSuggestion = {
  targetCount: number;
  sampleWarning?: string;
  contentDistribution: SimulationAllocationRow[];
  typeDistribution: SimulationAllocationRow[];
  resourceUse: Array<{ label: string; suggestedCount: number; sourceCount: number; percent: number }>;
  commands: string[];
  generalTerms: string[];
  physicsTerms: string[];
  assemblyGuide: string[];
  dataUsed: string[];
};

const SMALL_SAMPLE_LIMIT = 10;

export function getDefaultSimulationSize(summary: ProvaAnalysisSummary) {
  if (summary.total <= 0) return 20;
  if (summary.total < 10) return Math.max(5, summary.total);
  return Math.min(30, Math.max(20, summary.total));
}

export function buildSimulationSuggestion(summary: ProvaAnalysisSummary, targetCount: number): SimulationSuggestion {
  const normalizedTarget = normalizeTargetCount(targetCount);
  const contentRows = prepareContentRows(summary.contentFrequency);
  const typeRows = prepareTypeRows(summary.typeCounts);
  const contentDistribution = allocateRows(contentRows, normalizedTarget);
  const typeDistribution = allocateRows(typeRows, normalizedTarget);
  const resourceUse = buildResourceUse(summary, normalizedTarget);
  const commands = summary.commandFrequency.slice(0, 5).map((row) => row.term);
  const generalTerms = summary.generalTermFrequency.slice(0, 6).map((row) => row.term);
  const physicsTerms = summary.physicsTermFrequency.slice(0, 6).map((row) => row.term);

  return {
    targetCount: normalizedTarget,
    sampleWarning: summary.total < SMALL_SAMPLE_LIMIT
      ? `A sugestão foi gerada com base em apenas ${summary.total} questão${summary.total === 1 ? "" : "ões"}. Use como rascunho e revise manualmente.`
      : undefined,
    contentDistribution,
    typeDistribution,
    resourceUse,
    commands,
    generalTerms,
    physicsTerms,
    assemblyGuide: buildAssemblyGuide({ contentDistribution, typeDistribution, resourceUse, commands, generalTerms, physicsTerms, targetCount: normalizedTarget }),
    dataUsed: buildDataUsed(summary, contentDistribution, typeDistribution, commands),
  };
}

export function suggestionToText(suggestion: SimulationSuggestion) {
  const lines = [
    `Sugestão de simulado com ${suggestion.targetCount} item${suggestion.targetCount === 1 ? "" : "s"}.`,
    "",
    "Distribuição por conteúdo:",
    ...suggestion.contentDistribution.map((row) => `- ${row.label}: ${row.suggestedCount} item${row.suggestedCount === 1 ? "" : "s"} (${formatPercent(row.percent)} na base).`),
    "",
    "Distribuição por tipo de questão:",
    ...suggestion.typeDistribution.map((row) => `- ${row.label}: ${row.suggestedCount} item${row.suggestedCount === 1 ? "" : "s"} (${formatPercent(row.percent)} na base).`),
    "",
    "Recursos sugeridos:",
    ...suggestion.resourceUse.map((row) => `- ${row.label}: cerca de ${row.suggestedCount} item${row.suggestedCount === 1 ? "" : "s"}.`),
    "",
    "Comandos e linguagem:",
    `- Comandos: ${suggestion.commands.length > 0 ? suggestion.commands.join(", ") : "sem comandos frequentes suficientes"}.`,
    `- Termos gerais: ${suggestion.generalTerms.length > 0 ? suggestion.generalTerms.join(", ") : "sem termos gerais suficientes"}.`,
    `- Termos de Física: ${suggestion.physicsTerms.length > 0 ? suggestion.physicsTerms.join(", ") : "sem termos físicos suficientes"}.`,
    "",
    "Roteiro de montagem:",
    ...suggestion.assemblyGuide.map((item, index) => `${index + 1}. ${item}`),
  ];

  if (suggestion.sampleWarning) lines.splice(2, 0, suggestion.sampleWarning, "");
  return lines.join("\n");
}

function prepareContentRows(rows: FrequencyRow[]) {
  const useful = rows.filter((row) => isUseful(row.value));
  if (useful.length <= 8) return useful;

  const top = useful.slice(0, 7);
  const others = useful.slice(7);
  const otherCount = others.reduce((sum, row) => sum + row.count, 0);
  const otherYears = Array.from(new Set(others.flatMap((row) => row.years))).sort(compareNumericText);
  const total = useful.reduce((sum, row) => sum + row.count, 0);

  return [
    ...top,
    {
      value: "Outros conteúdos",
      count: otherCount,
      percent: total > 0 ? roundOne((otherCount / total) * 100) : 0,
      years: otherYears,
    },
  ];
}

function prepareTypeRows(rows: FrequencyRow[]) {
  return rows.filter((row) => isUseful(row.value)).map((row) => ({ ...row, value: formatType(row.value) }));
}

function allocateRows(rows: FrequencyRow[], targetCount: number): SimulationAllocationRow[] {
  const validRows = rows.filter((row) => row.count > 0);
  const total = validRows.reduce((sum, row) => sum + row.count, 0);
  if (validRows.length === 0 || total === 0) return [];

  const raw = validRows.map((row) => {
    const exact = (row.count / total) * targetCount;
    return {
      row,
      floor: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });

  let allocated = raw.reduce((sum, item) => sum + item.floor, 0);
  const orderedByRemainder = raw.slice().sort((a, b) => b.remainder - a.remainder || b.row.count - a.row.count);

  for (const item of orderedByRemainder) {
    if (allocated >= targetCount) break;
    item.floor += 1;
    allocated += 1;
  }

  return raw
    .filter((item) => item.floor > 0)
    .map((item) => ({
      label: item.row.value,
      suggestedCount: item.floor,
      sourceCount: item.row.count,
      percent: total > 0 ? roundOne((item.row.count / total) * 100) : 0,
      years: item.row.years,
    }))
    .sort((a, b) => b.suggestedCount - a.suggestedCount || b.sourceCount - a.sourceCount);
}

function buildResourceUse(summary: ProvaAnalysisSummary, targetCount: number) {
  return [
    toResourceRow("Com referência/texto-base", summary.withReference, summary.total, targetCount),
    toResourceRow("Com imagem", summary.withImage, summary.total, targetCount),
    toResourceRow("Com equação", summary.withEquation, summary.total, targetCount),
    toResourceRow("Com alternativas", summary.withAlternatives, summary.total, targetCount),
  ];
}

function toResourceRow(label: string, sourceCount: number, total: number, targetCount: number) {
  const percent = total > 0 ? roundOne((sourceCount / total) * 100) : 0;
  return {
    label,
    sourceCount,
    percent,
    suggestedCount: Math.round((percent / 100) * targetCount),
  };
}

function buildAssemblyGuide({ contentDistribution, typeDistribution, resourceUse, commands, generalTerms, physicsTerms, targetCount }: Pick<SimulationSuggestion, "contentDistribution" | "typeDistribution" | "resourceUse" | "commands" | "generalTerms" | "physicsTerms" | "targetCount">) {
  const guide: string[] = [];
  const topContent = contentDistribution[0];
  const topType = typeDistribution[0];
  const referenceRow = resourceUse.find((row) => row.label === "Com referência/texto-base");
  const equationRow = resourceUse.find((row) => row.label === "Com equação");

  guide.push(`Monte um simulado com ${targetCount} item${targetCount === 1 ? "" : "s"}, mantendo proporção próxima à base analisada.`);
  if (topContent) guide.push(`Priorize ${topContent.label}, com cerca de ${topContent.suggestedCount} item${topContent.suggestedCount === 1 ? "" : "s"}.`);
  if (contentDistribution.length > 1) guide.push(`Distribua os demais itens entre ${contentDistribution.slice(1, 5).map((row) => `${row.label} (${row.suggestedCount})`).join(", ")}.`);
  if (topType) guide.push(`Use principalmente questões do tipo ${topType.label}, com cerca de ${topType.suggestedCount} item${topType.suggestedCount === 1 ? "" : "s"}.`);
  if (referenceRow && referenceRow.suggestedCount > 0) guide.push(`Inclua aproximadamente ${referenceRow.suggestedCount} item${referenceRow.suggestedCount === 1 ? "" : "s"} com referência/texto-base.`);
  if (equationRow && equationRow.suggestedCount > 0) guide.push(`Inclua aproximadamente ${equationRow.suggestedCount} item${equationRow.suggestedCount === 1 ? "" : "s"} com equação ou símbolo matemático.`);
  if (commands.length > 0) guide.push(`Use comandos parecidos com os mais frequentes: ${commands.slice(0, 3).map((item) => `“${item}”`).join(", ")}.`);
  if (generalTerms.length > 0 || physicsTerms.length > 0) guide.push(`Mantenha a linguagem próxima da banca usando termos como ${[...generalTerms.slice(0, 3), ...physicsTerms.slice(0, 3)].join(", ")}.`);
  if (guide.length === 1) guide.push("A base ainda não possui dados suficientes para detalhar a distribuição por conteúdo, tipo e linguagem sem inventar padrões.");

  return guide;
}

function buildDataUsed(summary: ProvaAnalysisSummary, contentDistribution: SimulationAllocationRow[], typeDistribution: SimulationAllocationRow[], commands: string[]) {
  return [
    `Total analisado: ${summary.total} questão${summary.total === 1 ? "" : "ões"}.`,
    `Anos analisados: ${summary.years.length > 0 ? summary.years.join(", ") : "sem anos cadastrados"}.`,
    `Conteúdos usados na distribuição: ${contentDistribution.length > 0 ? contentDistribution.map((row) => `${row.label} (${formatPercent(row.percent)})`).join("; ") : "sem conteúdo suficiente"}.`,
    `Tipos usados na distribuição: ${typeDistribution.length > 0 ? typeDistribution.map((row) => `${row.label} (${formatPercent(row.percent)})`).join("; ") : "sem tipo suficiente"}.`,
    `Comandos considerados: ${commands.length > 0 ? commands.join(", ") : "sem comandos frequentes suficientes"}.`,
  ];
}

function isUseful(value: string) {
  const normalized = value.toLowerCase();
  return !normalized.startsWith("sem ") && normalized.trim().length > 0;
}

function normalizeTargetCount(value: number) {
  if (!Number.isFinite(value)) return 20;
  return Math.max(1, Math.min(120, Math.round(value)));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function formatType(tipo: string) {
  const labels: Record<string, string> = {
    multipla_escolha: "Múltipla escolha",
    certo_errado: "Certo ou errado",
    numerica: "Numérica",
    discursiva: "Discursiva",
    "Sem tipo": "Sem tipo",
  };
  return labels[tipo] ?? tipo;
}

function compareNumericText(a: string, b: string) {
  return a.localeCompare(b, "pt-BR", { numeric: true });
}
