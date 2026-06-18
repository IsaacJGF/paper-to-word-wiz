import { Alternativa as AlternativaBase, DigitalizacaoExtraida, QuestaoExtraida } from "@/lib/digitize.functions";

export type Alternativa = AlternativaBase & { imagem?: string };

export type DraftQuestion = Omit<QuestaoExtraida, "alternativas"> & {
  id?: string;
  disciplina?: string;
  conteudo?: string;
  dificuldade?: string;
  area_geral?: string;
  conteudo_principal?: string;
  subconteudo_principal?: string;
  conteudos_relacionados?: string[];
  tags_livres?: string[];
  ano?: string;
  prova?: string;
  instituicao?: string;
  observacoes?: string;
  alternativas: Alternativa[];
  enunciado_imagem?: string;
  enunciado_imagem_pos?: "antes" | "depois";
};
export type DraftDigitization = {
  referencia_texto: string;
  referencia_fonte: string;
  imageDataUrl?: string;
  questoes: DraftQuestion[];
};

const KEY = "digitalizador.draft";

export function saveDraft(q: DraftDigitization | DraftQuestion) {
  try { sessionStorage.setItem(KEY, JSON.stringify(q)); } catch {}
}
export function loadDraft(): DraftDigitization | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v ? normalizeDraft(JSON.parse(v) as DraftDigitization | DraftQuestion) : null;
  } catch { return null; }
}
export function clearDraft() {
  try { sessionStorage.removeItem(KEY); } catch {}
}

function normalizeDraft(draft: DraftDigitization | DraftQuestion): DraftDigitization {
  if ("questoes" in draft && Array.isArray(draft.questoes)) {
    return {
      referencia_texto: draft.referencia_texto ?? "",
      referencia_fonte: draft.referencia_fonte ?? "",
      imageDataUrl: draft.imageDataUrl,
      questoes: draft.questoes.length > 0 ? draft.questoes : [{
        numero: "",
        enunciado: "",
        alternativas: [],
        tipo: "discursiva",
        resposta: "",
        fonte: "",
        tem_equacao: false,
        tem_imagem: false,
        baixa_confianca: [],
      }],
    };
  }

  return {
    referencia_texto: "",
    referencia_fonte: "",
    imageDataUrl: undefined,
    questoes: [draft as DraftQuestion],
  };
}

export const LETRAS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export function reletter(alts: Alternativa[]): Alternativa[] {
  return alts.map((a, i) => ({ ...a, letra: LETRAS[i] ?? a.letra }));
}
