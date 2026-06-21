import type { FrequencyRow, ProvaAnalysisSummary, TermFrequencyRow } from "@/lib/prova-analysis";

export type AISummaryInput = {
  totalQuestions: number;
  years: string[];
  sampleWarning: boolean;
  topContents: Array<{ label: string; count: number; percent: number; years: string[] }>;
  topSubcontents: Array<{ label: string; count: number; percent: number; years: string[] }>;
  typeDistribution: Array<{ label: string; count: number; percent: number }>;
  topGeneralTerms: Array<{ label: string; count: number; questionCount: number; percent: number }>;
  topPhysicsTerms: Array<{ label: string; count: number; questionCount: number; percent: number }>;
  topCommands: Array<{ label: string; count: number; questionCount: number; percent: number }>;
  referenceUse: { count: number; percent: number };
  imageUse: { count: number; percent: number };
  equationUse: { count: number; percent: number };
  alternativeUse: { count: number; percent: number };
  dataQuality: {
    missingArea: number;
    missingContent: number;
    missingSubcontent: number;
    missingYear: number;
    missingType: number;
  };
};

export type AISummarySection = {
  title: string;
  text: string;
  evidence: string[];
};

export type AISummaryResult = {
  warning?: string;
  sections: AISummarySection[];
  simulationGuide: string[];
  structuredInput: AISummaryInput;
};

const SMALL_SAMPLE_LIMIT = 10;

export function buildAISummaryInput(summary: ProvaAnalysisSummary): AISummaryInput {
  return {
    totalQuestions: summary.total,
    years: summary.years,
    sampleWarning: summary.total < SMALL_SAMPLE_LIMIT,
    topContents: summary.contentFrequency.filter(isUsefulFrequency).slice(0, 5).map(toInputFrequency),
    topSubcontents: summary.subcontentFrequency.filter(isUsefulFrequency).slice(0, 5).map(toInputFrequency),
    typeDistribution: summary.typeCounts.filter(isUsefulFrequency).slice(0, 5).map((row) => ({
      label: formatType(row.value),
      count: row.count,
      percent: row.percent,
    })),
    topGeneralTerms: summary.generalTermFrequency.slice(0, 6).map(toInputTerm),
    topPhysicsTerms: summary.physicsTermFrequency.slice(0, 6).map(toInputTerm),
    topCommands: summary.commandFrequency.slice(0, 6).map(toInputTerm),
    referenceUse: { count: summary.withReference, percent: percent(summary.withReference, summary.total) },
    imageUse: { count: summary.withImage, percent: percent(summary.withImage, summary.total) },
    equationUse: { count: summary.withEquation, percent: percent(summary.withEquation, summary.total) },
    alternativeUse: { count: summary.withAlternatives, percent: percent(summary.withAlternatives, summary.total) },
    dataQuality: {
      missingArea: summary.missingMetadata.area,
      missingContent: summary.missingMetadata.content,
      missingSubcontent: summary.missingMetadata.subcontent,
      missingYear: summary.missingMetadata.year,
      missingType: summary.missingMetadata.type,
    },
  };
}

export function generateAISummaryFromData(summary: ProvaAnalysisSummary): AISummaryResult {
  const input = buildAISummaryInput(summary);
  const sections: AISummarySection[] = [];

  sections.push(contentSection(input));
  sections.push(typeSection(input));
  sections.push(calculationInterpretationSection(input));
  sections.push(recurringThemesSection(input));
  sections.push(languageSection(input));

  return {
    warning: input.sampleWarning
      ? `A análise foi feita com apenas ${input.totalQuestions} questão${input.totalQuestions === 1 ? "" : "ões"}. As conclusões devem ser interpretadas com cautela.`
      : undefined,
    sections,
    simulationGuide: buildSimulationGuide(input),
    structuredInput: input,
  };
}

function contentSection(input: AISummaryInput): AISummarySection {
  if (input.topContents.length === 0) {
    return {
      title: "Conteúdos mais cobrados",
      text: "Não há dados suficientes de conteúdo principal para afirmar quais assuntos mais caem.",
      evidence: ["Nenhum conteúdo principal apareceu com cadastro válido no resumo estruturado."],
    };
  }

  const [first, second, third] = input.topContents;
  const rest = [second, third].filter(Boolean).map((item) => `${item.label} (${formatPercent(item.percent)})`).join(" e ");
  return {
    title: "Conteúdos mais cobrados",
    text: rest
      ? `${first.label} é o conteúdo mais frequente da base analisada, seguido por ${rest}.`
      : `${first.label} é o conteúdo mais frequente da base analisada.`,
    evidence: input.topContents.map((item) => `${item.label}: ${item.count} questão${item.count === 1 ? "" : "ões"} (${formatPercent(item.percent)}).`),
  };
}

function typeSection(input: AISummaryInput): AISummarySection {
  if (input.typeDistribution.length === 0) {
    return {
      title: "Tipo de questão mais comum",
      text: "Não há tipos de questão suficientes para identificar um padrão de formato.",
      evidence: ["Nenhum tipo apareceu com cadastro válido no resumo estruturado."],
    };
  }

  const top = input.typeDistribution[0];
  return {
    title: "Tipo de questão mais comum",
    text: `${top.label} é o formato mais comum na base analisada, representando ${formatPercent(top.percent)} das questões.` ,
    evidence: input.typeDistribution.map((item) => `${item.label}: ${item.count} questão${item.count === 1 ? "" : "ões"} (${formatPercent(item.percent)}).`),
  };
}

function calculationInterpretationSection(input: AISummaryInput): AISummarySection {
  const calculationTerms = ["calcule", "determine"];
  const interpretationTerms = ["julgue", "correto", "incorreto", "de acordo com", "com base no texto"];
  const calculationScore = scoreTerms(input.topGeneralTerms, calculationTerms) + input.equationUse.count;
  const interpretationScore = scoreTerms(input.topGeneralTerms, interpretationTerms) + input.referenceUse.count;

  if (calculationScore === 0 && interpretationScore === 0) {
    return {
      title: "Cálculo ou interpretação",
      text: "Não há dados suficientes para afirmar se a prova cobra mais cálculo ou interpretação.",
      evidence: ["Não foram encontrados comandos ou indicadores suficientes no resumo estruturado."],
    };
  }

  if (calculationScore > interpretationScore) {
    return {
      title: "Cálculo ou interpretação",
      text: "A base analisada apresenta mais sinais de cobrança quantitativa/cálculo do que de interpretação textual.",
      evidence: [
        `Equações aparecem em ${input.equationUse.count} questão${input.equationUse.count === 1 ? "" : "ões"} (${formatPercent(input.equationUse.percent)}).`,
        ...input.topGeneralTerms.filter((term) => calculationTerms.includes(term.label.toLowerCase())).map((term) => `${term.label}: ${term.count} ocorrência${term.count === 1 ? "" : "s"}.`),
      ],
    };
  }

  if (interpretationScore > calculationScore) {
    return {
      title: "Cálculo ou interpretação",
      text: "A base analisada apresenta mais sinais de interpretação, julgamento de afirmativas e uso de texto-base do que de cálculo direto.",
      evidence: [
        `Referência/texto-base aparece em ${input.referenceUse.count} questão${input.referenceUse.count === 1 ? "" : "ões"} (${formatPercent(input.referenceUse.percent)}).`,
        ...input.topGeneralTerms.filter((term) => interpretationTerms.includes(term.label.toLowerCase())).map((term) => `${term.label}: ${term.count} ocorrência${term.count === 1 ? "" : "s"}.`),
      ],
    };
  }

  return {
    title: "Cálculo ou interpretação",
    text: "A base analisada está equilibrada entre sinais de cálculo e sinais de interpretação.",
    evidence: [
      `Equações: ${input.equationUse.count} questão${input.equationUse.count === 1 ? "" : "ões"}.`,
      `Referências/textos-base: ${input.referenceUse.count} questão${input.referenceUse.count === 1 ? "" : "ões"}.`,
    ],
  };
}

function recurringThemesSection(input: AISummaryInput): AISummarySection {
  const recurrent = input.topContents.filter((item) => item.years.length >= 2);
  if (recurrent.length === 0) {
    return {
      title: "Temas recorrentes",
      text: "Não há recorrência suficiente por ano para afirmar que algum tema aparece de forma contínua.",
      evidence: ["Nenhum conteúdo principal apareceu em pelo menos dois anos no resumo estruturado."],
    };
  }

  return {
    title: "Temas recorrentes",
    text: `${recurrent.map((item) => item.label).join(", ")} ${recurrent.length === 1 ? "aparece" : "aparecem"} em mais de um ano da base analisada.`,
    evidence: recurrent.map((item) => `${item.label}: apareceu em ${item.years.join(", ")}.`),
  };
}

function languageSection(input: AISummaryInput): AISummarySection {
  const terms = input.topGeneralTerms.slice(0, 3).map((term) => term.label);
  const commands = input.topCommands.slice(0, 3).map((term) => term.label);
  const physicsTerms = input.topPhysicsTerms.slice(0, 3).map((term) => term.label);

  if (terms.length === 0 && commands.length === 0 && physicsTerms.length === 0) {
    return {
      title: "Linguagem da banca",
      text: "Não há termos ou comandos frequentes suficientes para caracterizar a linguagem da banca.",
      evidence: ["Nenhum termo monitorado apareceu no resumo estruturado."],
    };
  }

  return {
    title: "Linguagem da banca",
    text: `A linguagem da base é marcada por ${listOrFallback(terms, "termos gerais não identificados")}${commands.length > 0 ? ` e por comandos como ${commands.join(", ")}` : ""}.`,
    evidence: [
      ...input.topGeneralTerms.slice(0, 4).map((term) => `${term.label}: ${term.count} ocorrência${term.count === 1 ? "" : "s"}.`),
      ...input.topCommands.slice(0, 4).map((term) => `${term.label}: ${term.count} ocorrência${term.count === 1 ? "" : "s"}.`),
      ...input.topPhysicsTerms.slice(0, 4).map((term) => `${term.label}: ${term.count} ocorrência${term.count === 1 ? "" : "s"}.`),
    ],
  };
}

function buildSimulationGuide(input: AISummaryInput) {
  const guide: string[] = [];
  const topContent = input.topContents[0];
  const topType = input.typeDistribution[0];

  if (topContent) guide.push(`Priorizar ${topContent.label}, pois ele representa ${formatPercent(topContent.percent)} da base analisada.`);
  if (input.topContents.length > 1) guide.push(`Distribuir o restante entre ${input.topContents.slice(1, 4).map((item) => item.label).join(", ")}.`);
  if (topType) guide.push(`Usar mais questões do tipo ${topType.label}, pois esse formato representa ${formatPercent(topType.percent)} da base.`);
  if (input.referenceUse.count > 0) guide.push(`Incluir textos-base/referências em proporção próxima de ${formatPercent(input.referenceUse.percent)} das questões.`);
  if (input.topCommands.length > 0) guide.push(`Reproduzir comandos característicos como ${input.topCommands.slice(0, 3).map((item) => `“${item.label}”`).join(", ")}.`);
  if (input.sampleWarning) guide.push("Usar essas orientações com cautela, porque a amostra ainda é pequena.");
  if (guide.length === 0) guide.push("Não há dados suficientes para sugerir uma estrutura de simulado sem inventar padrões.");

  return guide;
}

function isUsefulFrequency(row: FrequencyRow) {
  return !row.value.toLowerCase().startsWith("sem ") && row.count > 0;
}

function toInputFrequency(row: FrequencyRow) {
  return { label: row.value, count: row.count, percent: row.percent, years: row.years };
}

function toInputTerm(row: TermFrequencyRow) {
  return { label: row.term, count: row.count, questionCount: row.questionCount, percent: row.percent };
}

function scoreTerms(terms: Array<{ label: string; count: number }>, targets: string[]) {
  const normalizedTargets = targets.map((target) => target.toLowerCase());
  return terms
    .filter((term) => normalizedTargets.includes(term.label.toLowerCase()))
    .reduce((sum, term) => sum + term.count, 0);
}

function percent(value: number, total: number) {
  if (total === 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function listOrFallback(values: string[], fallback: string) {
  return values.length > 0 ? values.join(", ") : fallback;
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
