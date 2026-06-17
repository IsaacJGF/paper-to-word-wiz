import { Alternativa, QuestaoExtraida } from "@/lib/digitize.functions";

export type DraftQuestion = QuestaoExtraida & {
  id?: string;
  imageDataUrl?: string;
  disciplina?: string;
  conteudo?: string;
  dificuldade?: string;
  ano?: string;
  prova?: string;
  instituicao?: string;
  observacoes?: string;
  tipo: "multipla_escolha" | "certo_errado" | "numerica" | "discursiva";
};

const KEY = "digitalizador.draft";

export function saveDraft(q: DraftQuestion) {
  try { sessionStorage.setItem(KEY, JSON.stringify(q)); } catch {}
}
export function loadDraft(): DraftQuestion | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v ? JSON.parse(v) as DraftQuestion : null;
  } catch { return null; }
}
export function clearDraft() {
  try { sessionStorage.removeItem(KEY); } catch {}
}

export const LETRAS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export function reletter(alts: Alternativa[]): Alternativa[] {
  return alts.map((a, i) => ({ ...a, letra: LETRAS[i] ?? a.letra }));
}
