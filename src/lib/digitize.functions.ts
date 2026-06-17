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

const SYSTEM = `Você é um OCR especializado em digitalização de questões de prova em português brasileiro.

Analise a imagem fornecida e extraia a questão de forma estruturada. Retorne APENAS um objeto JSON válido com este formato exato:

{
  "numero": "string (ex: \\"1\\", \\"15\\" ou \\"\\" se não houver)",
  "enunciado": "string com o texto completo do enunciado, incluindo texto de apoio e comando",
  "alternativas": [{"letra": "A", "texto": "..."}, ...],
  "tipo": "multipla_escolha" | "certo_errado" | "numerica" | "discursiva",
  "resposta": "string (gabarito se visível, senão \\"\\")",
  "fonte": "string (instituição/prova/ano se visível, senão \\"\\")",
  "tem_equacao": boolean,
  "tem_imagem": boolean,
  "baixa_confianca": ["trechos com baixa confiança de leitura"]
}

REGRAS CRÍTICAS:
- NÃO invente texto, números ou símbolos que não estejam legíveis. Se um trecho estiver ilegível, escreva "[ilegível]" no local e adicione à lista "baixa_confianca".
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

    let parsed: QuestaoExtraida;
    try {
      parsed = extractJSON(raw) as QuestaoExtraida;
    } catch (e) {
      console.error("Falha ao parsear resposta da IA:", raw);
      throw new Error("A IA retornou um formato inválido. Tente novamente.");
    }
    // Normalize defaults so downstream code is safe
    parsed.numero = parsed.numero ?? "";
    parsed.enunciado = parsed.enunciado ?? "";
    parsed.alternativas = Array.isArray(parsed.alternativas) ? parsed.alternativas : [];
    parsed.tipo = parsed.tipo ?? "discursiva";
    parsed.resposta = parsed.resposta ?? "";
    parsed.fonte = parsed.fonte ?? "";
    parsed.tem_equacao = !!parsed.tem_equacao;
    parsed.tem_imagem = !!parsed.tem_imagem;
    parsed.baixa_confianca = Array.isArray(parsed.baixa_confianca) ? parsed.baixa_confianca : [];
    return parsed;
  });

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
  });
