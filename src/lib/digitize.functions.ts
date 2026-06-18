import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callGeminiVision } from "./ai-gateway.server";

const Input = z.object({
  imageDataUrl: z.string().min(20),
});

export type Alternativa = { letra: string; texto: string };
export type QuestaoExtraida = {
  numero: string;
  enunciado: string;
  alternativas: Alternativa[];
  tipo: "multipla_escolha" | "certo_errado" | "numerica" | "discursiva";
  resposta: string;
  fonte: string;
  tem_equacao: boolean;
  tem_imagem: boolean;
  baixa_confianca: string[];
};
export type DigitalizacaoExtraida = {
  referencia_texto: string;
  referencia_fonte: string;
  questoes: QuestaoExtraida[];
};

const SYSTEM = `Você é um OCR especializado em digitalização de questões de prova em português brasileiro.

Analise a imagem fornecida e extraia a digitalização de forma estruturada. A imagem pode conter uma questão única OU um texto-base/referência seguido por vários itens numerados.

Retorne APENAS um objeto JSON válido com este formato exato:

{
  "referencia_texto": "texto-base, comando geral, tabela, descrição de imagem ou contexto comum aos itens; use \\"\\" se não houver",
  "referencia_fonte": "fonte da referência, por exemplo Internet, ENEM, banca/ano; use \\"\\" se não houver",
  "questoes": [
    {
      "numero": "string (ex: \\"1\\", \\"86\\" ou \\"\\" se não houver)",
      "enunciado": "texto específico do item/questão, sem repetir a referência comum",
      "alternativas": [{"letra": "A", "texto": "..."}, ...],
      "tipo": "multipla_escolha" | "certo_errado" | "numerica" | "discursiva",
      "resposta": "string (gabarito se visível, senão \\"\\")",
      "fonte": "string (instituição/prova/ano se visível, senão \\"\\")",
      "tem_equacao": boolean,
      "tem_imagem": boolean,
      "baixa_confianca": ["trechos com baixa confiança de leitura"]
    }
  ]
}

REGRAS CRÍTICAS:
- NÃO invente texto, números ou símbolos que não estejam legíveis. Se um trecho estiver ilegível, escreva "[ilegível]" no local e adicione à lista "baixa_confianca".
- Se houver um texto, imagem, tabela ou comando que vale para vários itens, coloque isso em "referencia_texto" e NÃO repita em cada "enunciado".
- Em itens de julgamento como "julgue os próximos itens", use tipo "certo_errado", alternativas [] e crie uma questão para cada item numerado.
- Se houver vários itens numerados (ex: 86, 87, 88), cada item deve virar um objeto próprio em "questoes".
- Se houver apenas uma questão, retorne "questoes" com um único objeto.
- Preserve equações usando notação LaTeX entre cifrões: $x^2 + 2x$ inline, ou $$\\frac{a}{b}$$ em linha separada.
- Use letras gregas em LaTeX: $\\alpha$, $\\pi$, $\\Delta$.
- Frações: $\\frac{numerador}{denominador}$. Potências: $x^{2}$. Índices: $H_{2}O$. Raízes: $\\sqrt{x}$.
- Separe corretamente o enunciado das alternativas. Cada alternativa em um objeto próprio com letra (A, B, C, D, E) e texto.
- Se a questão for de certo/errado, use alternativas vazias [] e tipo "certo_errado".
- Se a questão for discursiva ou numérica, alternativas = [].
- tem_imagem = true se a questão contém gráfico, figura, tabela ou diagrama.
- tem_equacao = true se contém qualquer notação matemática/química.
- Retorne SOMENTE o JSON, sem markdown, sem explicações.`;

export const digitizeQuestion = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const raw = await callGeminiVision({
      apiKey,
      model: "google/gemini-2.5-flash",
      systemPrompt: SYSTEM,
      userText: "Digitalize esta questão seguindo as regras do sistema.",
      imageDataUrl: data.imageDataUrl,
    });

    let parsed: DigitalizacaoExtraida | QuestaoExtraida;
    try {
      parsed = extractJSON(raw) as DigitalizacaoExtraida | QuestaoExtraida;
    } catch (e) {
      console.error("Falha ao parsear resposta da IA:", raw);
      throw new Error("A IA retornou um formato inválido. Tente novamente.");
    }
    return normalizeDigitization(parsed);
  });

function normalizeQuestion(q: Partial<QuestaoExtraida>): QuestaoExtraida {
  return {
    numero: q.numero ?? "",
    enunciado: q.enunciado ?? "",
    alternativas: Array.isArray(q.alternativas) ? q.alternativas : [],
    tipo: q.tipo ?? "discursiva",
    resposta: q.resposta ?? "",
    fonte: q.fonte ?? "",
    tem_equacao: !!q.tem_equacao,
    tem_imagem: !!q.tem_imagem,
    baixa_confianca: Array.isArray(q.baixa_confianca) ? q.baixa_confianca : [],
  };
}

function normalizeDigitization(parsed: DigitalizacaoExtraida | QuestaoExtraida): DigitalizacaoExtraida {
  if ("questoes" in parsed && Array.isArray(parsed.questoes)) {
    const questoes = parsed.questoes.map(normalizeQuestion);
    return {
      referencia_texto: parsed.referencia_texto ?? "",
      referencia_fonte: parsed.referencia_fonte ?? "",
      questoes: questoes.length > 0 ? questoes : [normalizeQuestion({})],
    };
  }

  return {
    referencia_texto: "",
    referencia_fonte: "",
    questoes: [normalizeQuestion(parsed)],
  };
}

function extractJSON(raw: string): unknown {
  let cleaned = raw
    .replace(/^\uFEFF/, "")
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();

  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const objStart = cleaned.indexOf("{");
    const arrStart = cleaned.indexOf("[");
    const isArray = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
    const start = isArray ? arrStart : objStart;
    const end = isArray ? cleaned.lastIndexOf("]") : cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      cleaned = cleaned.slice(start, end + 1);
    } else {
      throw new Error("No JSON found");
    }
  }
  return JSON.parse(cleaned);
}
