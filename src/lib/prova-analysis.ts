export type ProvaAnalysisQuestion = {
  id: string;
  numero?: string | null;
  enunciado?: string | null;
  tipo?: string | null;
  ano?: string | null;
  prova?: string | null;
  instituicao?: string | null;
  area_geral?: string | null;
  conteudo_principal?: string | null;
  subconteudo_principal?: string | null;
  conteudos_relacionados?: string[] | null;
  tags_livres?: string[] | null;
  tags?: string[] | null;
  referencia_texto?: string | null;
  referencia_texto_apos?: string | null;
  referencia_imagem?: string | null;
  enunciado_imagem?: string | null;
  tem_imagem?: boolean | null;
  tem_equacao?: boolean | null;
  alternativas?: Array<{ letra?: string; texto?: string; imagem?: string | null }> | null;
};

export type FrequencyRow = {
  value: string;
  count: number;
  percent: number;
  years: string[];
};

export type YearCountRow = {
  year: string;
  count: number;
};

export type TermExample = {
  questionId: string;
  numero?: string | null;
  prova?: string | null;
  ano?: string | null;
  preview: string;
};

export type TermFrequencyRow = {
  term: string;
  count: number;
  questionCount: number;
  percent: number;
  years: string[];
  examples: TermExample[];
};

export type ProvaAnalysisSummary = {
  questions: ProvaAnalysisQuestion[];
  total: number;
  years: string[];
  questionsByYear: YearCountRow[];
  areaFrequency: FrequencyRow[];
  contentFrequency: FrequencyRow[];
  subcontentFrequency: FrequencyRow[];
  relatedContentFrequency: FrequencyRow[];
  tagFrequency: FrequencyRow[];
  typeCounts: FrequencyRow[];
  generalTermFrequency: TermFrequencyRow[];
  physicsTermFrequency: TermFrequencyRow[];
  commandFrequency: TermFrequencyRow[];
  withReference: number;
  withImage: number;
  withEquation: number;
  withAlternatives: number;
  missingMetadata: {
    area: number;
    content: number;
    subcontent: number;
    year: number;
    type: number;
  };
};

const EMPTY_LABELS = {
  area: "Sem área geral",
  content: "Sem conteúdo principal",
  subcontent: "Sem subconteúdo principal",
  type: "Sem tipo",
  year: "Sem ano",
} as const;

const GENERAL_TERMS = [
  "considere",
  "julgue",
  "assinale",
  "correto",
  "incorreto",
  "de acordo com",
  "com base no texto",
  "sabendo que",
  "despreze",
  "determine",
  "calcule",
  "conclui-se",
];

const PHYSICS_TERMS = [
  "velocidade",
  "força",
  "energia",
  "aceleração",
  "campo",
  "pressão",
  "corrente",
  "calor",
  "onda",
  "frequência",
  "massa",
  "equilíbrio",
  "deslocamento",
  "potência",
  "resistência",
  "temperatura",
];

const COMMAND_PATTERNS = [
  "Considerando o texto acima",
  "Julgue os itens",
  "É correto afirmar que",
  "Com base na figura",
  "De acordo com o texto",
  "Desprezando a resistência do ar",
  "Sabendo que",
  "Assinale a alternativa correta",
  "Conclui-se que",
];

export function analyzeProvaQuestions(questions: ProvaAnalysisQuestion[]): ProvaAnalysisSummary {
  const normalized = questions.map(normalizeQuestionForAnalysis);
  const total = normalized.length;

  return {
    questions: normalized,
    total,
    years: uniqueYears(normalized),
    questionsByYear: countYears(normalized),
    areaFrequency: frequencyFromSingleField(normalized, (q) => q.area_geral, EMPTY_LABELS.area),
    contentFrequency: frequencyFromSingleField(normalized, (q) => q.conteudo_principal, EMPTY_LABELS.content),
    subcontentFrequency: frequencyFromSingleField(normalized, (q) => q.subconteudo_principal, EMPTY_LABELS.subcontent),
    relatedContentFrequency: frequencyFromArrayField(normalized, (q) => q.conteudos_relacionados ?? []),
    tagFrequency: frequencyFromArrayField(normalized, (q) => q.tags_livres?.length ? q.tags_livres : q.tags ?? []),
    typeCounts: frequencyFromSingleField(normalized, (q) => q.tipo, EMPTY_LABELS.type),
    generalTermFrequency: analyzeTerms(normalized, GENERAL_TERMS),
    physicsTermFrequency: analyzeTerms(normalized, PHYSICS_TERMS),
    commandFrequency: analyzeTerms(normalized, COMMAND_PATTERNS),
    withReference: normalized.filter(hasReference).length,
    withImage: normalized.filter(hasImage).length,
    withEquation: normalized.filter((q) => Boolean(q.tem_equacao)).length,
    withAlternatives: normalized.filter(hasAlternatives).length,
    missingMetadata: {
      area: normalized.filter((q) => !q.area_geral).length,
      content: normalized.filter((q) => !q.conteudo_principal).length,
      subcontent: normalized.filter((q) => !q.subconteudo_principal).length,
      year: normalized.filter((q) => !q.ano).length,
      type: normalized.filter((q) => !q.tipo).length,
    },
  };
}

export function hasReference(question: ProvaAnalysisQuestion) {
  return Boolean(question.referencia_texto?.trim() || question.referencia_texto_apos?.trim() || question.referencia_imagem);
}

export function hasImage(question: ProvaAnalysisQuestion) {
  return Boolean(
    question.tem_imagem ||
    question.referencia_imagem ||
    question.enunciado_imagem ||
    question.alternativas?.some((alt) => alt.imagem),
  );
}

export function hasAlternatives(question: ProvaAnalysisQuestion) {
  return Array.isArray(question.alternativas) && question.alternativas.length > 0;
}

function normalizeQuestionForAnalysis(question: ProvaAnalysisQuestion): ProvaAnalysisQuestion {
  return {
    ...question,
    numero: normalizeNullableText(question.numero),
    enunciado: question.enunciado ?? "",
    tipo: normalizeNullableText(question.tipo),
    ano: normalizeNullableText(question.ano),
    prova: normalizeNullableText(question.prova),
    instituicao: normalizeNullableText(question.instituicao),
    area_geral: normalizeNullableText(question.area_geral),
    conteudo_principal: normalizeNullableText(question.conteudo_principal),
    subconteudo_principal: normalizeNullableText(question.subconteudo_principal),
    conteudos_relacionados: normalizeTextArray(question.conteudos_relacionados),
    tags_livres: normalizeTextArray(question.tags_livres),
    tags: normalizeTextArray(question.tags),
    referencia_texto: normalizeNullableText(question.referencia_texto),
    referencia_texto_apos: normalizeNullableText(question.referencia_texto_apos),
    referencia_imagem: normalizeNullableText(question.referencia_imagem),
    enunciado_imagem: normalizeNullableText(question.enunciado_imagem),
    tem_imagem: Boolean(question.tem_imagem),
    tem_equacao: Boolean(question.tem_equacao),
    alternativas: Array.isArray(question.alternativas) ? question.alternativas : [],
  };
}

function frequencyFromSingleField(
  questions: ProvaAnalysisQuestion[],
  getter: (question: ProvaAnalysisQuestion) => string | null | undefined,
  emptyLabel: string,
) {
  const map = new Map<string, { count: number; years: Set<string> }>();
  for (const question of questions) {
    const value = normalizeNullableText(getter(question)) || emptyLabel;
    addFrequency(map, value, question.ano);
  }
  return toFrequencyRows(map, questions.length);
}

function frequencyFromArrayField(
  questions: ProvaAnalysisQuestion[],
  getter: (question: ProvaAnalysisQuestion) => string[],
) {
  const map = new Map<string, { count: number; years: Set<string> }>();
  for (const question of questions) {
    const values = uniqueText(getter(question));
    for (const value of values) addFrequency(map, value, question.ano);
  }
  return toFrequencyRows(map, questions.length);
}

function analyzeTerms(questions: ProvaAnalysisQuestion[], terms: string[]): TermFrequencyRow[] {
  const total = questions.length;
  return terms
    .map((term) => {
      let count = 0;
      const years = new Set<string>();
      const examples: TermExample[] = [];
      const normalizedTerm = normalizeForSearch(term);

      for (const question of questions) {
        const text = getSearchableQuestionText(question);
        const occurrences = countOccurrences(text, normalizedTerm);
        if (occurrences === 0) continue;

        count += occurrences;
        if (question.ano) years.add(question.ano);
        if (examples.length < 3) examples.push(buildTermExample(question));
      }

      return {
        term,
        count,
        questionCount: examples.length === 0 ? 0 : questions.filter((question) => countOccurrences(getSearchableQuestionText(question), normalizedTerm) > 0).length,
        percent: total > 0 ? Math.round((examples.length === 0 ? 0 : questions.filter((question) => countOccurrences(getSearchableQuestionText(question), normalizedTerm) > 0).length / total) * 1000) / 10 : 0,
        years: Array.from(years).sort(compareNumericText),
        examples,
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term, "pt-BR"));
}

function countYears(questions: ProvaAnalysisQuestion[]): YearCountRow[] {
  const map = new Map<string, number>();
  for (const question of questions) {
    const year = question.ano || EMPTY_LABELS.year;
    map.set(year, (map.get(year) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => compareNumericText(a.year, b.year));
}

function uniqueYears(questions: ProvaAnalysisQuestion[]) {
  return uniqueText(questions.map((q) => q.ano).filter((year): year is string => Boolean(year)))
    .sort(compareNumericText);
}

function addFrequency(map: Map<string, { count: number; years: Set<string> }>, value: string, year?: string | null) {
  const current = map.get(value) ?? { count: 0, years: new Set<string>() };
  current.count += 1;
  if (year) current.years.add(year);
  map.set(value, current);
}

function toFrequencyRows(map: Map<string, { count: number; years: Set<string> }>, total: number): FrequencyRow[] {
  return Array.from(map.entries())
    .map(([value, data]) => ({
      value,
      count: data.count,
      percent: total > 0 ? Math.round((data.count / total) * 1000) / 10 : 0,
      years: Array.from(data.years).sort(compareNumericText),
    }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "pt-BR"));
}

function getSearchableQuestionText(question: ProvaAnalysisQuestion) {
  return normalizeForSearch([
    question.referencia_texto,
    question.referencia_texto_apos,
    question.enunciado,
    ...(question.alternativas ?? []).map((alt) => alt.texto),
  ].filter(Boolean).join("\n"));
}

function countOccurrences(text: string, normalizedTerm: string) {
  if (!text || !normalizedTerm) return 0;
  const pattern = new RegExp(`(^|\\W)${escapeRegExp(normalizedTerm)}(?=\\W|$)`, "g");
  return text.match(pattern)?.length ?? 0;
}

function buildTermExample(question: ProvaAnalysisQuestion): TermExample {
  return {
    questionId: question.id,
    numero: question.numero,
    prova: question.prova,
    ano: question.ano,
    preview: buildPreview(question),
  };
}

function buildPreview(question: ProvaAnalysisQuestion) {
  const text = [question.enunciado, question.referencia_texto, question.referencia_texto_apos]
    .map((value) => value ?? "")
    .find((value) => value.trim().length > 0) ?? "Sem texto cadastrado.";
  const clean = text.replace(/<[^>]+>/g, " ").replace(/\$+/g, "").replace(/\s+/g, " ").trim();
  return clean.length > 180 ? `${clean.slice(0, 177)}...` : clean;
}

function normalizeForSearch(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTextArray(values: string[] | null | undefined) {
  return uniqueText((values ?? []).map((value) => normalizeNullableText(value)).filter((value): value is string => Boolean(value)));
}

function uniqueText(values: string[]) {
  return Array.from(new Set(values));
}

function compareNumericText(a: string, b: string) {
  return a.localeCompare(b, "pt-BR", { numeric: true });
}
