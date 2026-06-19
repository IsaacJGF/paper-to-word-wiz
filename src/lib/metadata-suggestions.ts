import type { DraftQuestion } from "@/lib/draft-store";

type CatalogItem = { id: string; nome: string; ativo: boolean; area_id?: string; conteudo_id?: string };

export type MetadataSuggestion = {
  area_geral?: string;
  conteudo_principal?: string;
  subconteudo_principal?: string;
  conteudos_relacionados: string[];
  tags_livres: string[];
};

export function suggestQuestionMetadata({
  question,
  referenceText,
  areas,
  conteudos,
  subconteudos,
  relacionados,
  tags,
}: {
  question: DraftQuestion;
  referenceText: string;
  areas: CatalogItem[];
  conteudos: CatalogItem[];
  subconteudos: CatalogItem[];
  relacionados: CatalogItem[];
  tags: CatalogItem[];
}): MetadataSuggestion {
  const text = normalize([
    referenceText,
    question.enunciado,
    question.fonte ?? "",
    question.resposta ?? "",
    ...question.alternativas.map((alt) => alt.texto),
  ].join(" "));

  const areaById = new Map(areas.map((area) => [area.id, area]));
  const conteudoById = new Map(conteudos.map((conteudo) => [conteudo.id, conteudo]));
  const subScores = bestMatches(subconteudos, text, 1, 42);
  const contentScores = bestMatches(conteudos, text, 1, 36);
  const areaScores = bestMatches(areas, text, 1, 30);

  let area_geral: string | undefined;
  let conteudo_principal: string | undefined;
  let subconteudo_principal: string | undefined;

  const bestSub = subScores[0]?.item;
  if (bestSub?.conteudo_id) {
    const parentContent = conteudoById.get(bestSub.conteudo_id);
    const parentArea = parentContent?.area_id ? areaById.get(parentContent.area_id) : undefined;
    subconteudo_principal = bestSub.nome;
    conteudo_principal = parentContent?.nome;
    area_geral = parentArea?.nome;
  } else {
    const bestContent = contentScores[0]?.item;
    if (bestContent?.area_id) {
      conteudo_principal = bestContent.nome;
      area_geral = areaById.get(bestContent.area_id)?.nome;
    } else {
      area_geral = areaScores[0]?.item.nome;
    }
  }

  const related = bestMatches(relacionados, text, 6, 22).map(({ item }) => item.nome);
  const tagNames = new Set(bestMatches(tags, text, 6, 20).map(({ item }) => item.nome));
  for (const name of heuristicTags(text, question)) {
    if (tags.some((tag) => tag.nome === name && tag.ativo)) tagNames.add(name);
  }

  return {
    area_geral,
    conteudo_principal,
    subconteudo_principal,
    conteudos_relacionados: related,
    tags_livres: [...tagNames].slice(0, 8),
  };
}

export function hasMetadataSuggestion(suggestion: MetadataSuggestion) {
  return Boolean(
    suggestion.area_geral ||
    suggestion.conteudo_principal ||
    suggestion.subconteudo_principal ||
    suggestion.conteudos_relacionados.length > 0 ||
    suggestion.tags_livres.length > 0,
  );
}

export function formatMetadataSuggestion(suggestion: MetadataSuggestion) {
  return [
    ["Área geral", suggestion.area_geral],
    ["Conteúdo principal", suggestion.conteudo_principal],
    ["Subconteúdo principal", suggestion.subconteudo_principal],
    ["Conteúdos relacionados", suggestion.conteudos_relacionados.join(", ")],
    ["Tags", suggestion.tags_livres.join(", ")],
  ]
    .map(([label, value]) => `${label}: ${value || "sem sugestão"}`)
    .join("\n");
}

function bestMatches(items: CatalogItem[], text: string, limit: number, minScore: number) {
  return items
    .filter((item) => item.ativo)
    .map((item) => ({ item, score: scoreName(item.nome, text) }))
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score || a.item.nome.localeCompare(b.item.nome, "pt-BR"))
    .slice(0, limit);
}

function scoreName(name: string, text: string) {
  const normalizedName = normalize(name);
  if (!normalizedName) return 0;
  let score = 0;
  if (text.includes(normalizedName)) score += 80 + normalizedName.length;

  const words = normalizedName.split(" ").filter((word) => word.length > 2);
  const matchedWords = words.filter((word) => text.includes(word));
  if (words.length > 0 && matchedWords.length === words.length) score += 35 + words.length * 4;
  score += matchedWords.filter((word) => word.length > 4).length * 8;
  score += matchedWords.filter((word) => word.length > 7).length * 4;
  return score;
}

function heuristicTags(text: string, question: DraftQuestion) {
  const tags = new Set<string>();
  if (/\d/.test(text)) tags.add("Com dados numéricos");
  if (/\d/.test(text) && /(calcule|determine|qual|valor|resultado|velocidade|forca|energia|pressao|corrente|tensao)/.test(text)) {
    tags.add("Cálculo direto");
    tags.add("Questão de análise quantitativa");
  }
  if (/(grafico|curva|eixo|tabela)/.test(text)) tags.add(text.includes("tabela") ? "Com tabela" : "Com gráfico");
  if (/(figura|imagem|esquema|diagrama)/.test(text)) tags.add(text.includes("diagrama") ? "Com diagrama de forças" : "Com imagem");
  if (/(experimento|laboratorio|medicao|medida)/.test(text)) tags.add("Questão experimental");
  if (/(cotidiano|dia a dia|transito|esporte|casa|escola|industria|tecnologia)/.test(text)) tags.add("Questão contextualizada");
  if (question.tipo === "multipla_escolha") tags.add("Múltipla escolha");
  if (question.tipo === "certo_errado") tags.add("Certo ou errado");
  if (question.tipo === "discursiva") tags.add("Resposta discursiva");
  if (question.tipo === "numerica") tags.add("Resposta numérica");
  return [...tags];
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
