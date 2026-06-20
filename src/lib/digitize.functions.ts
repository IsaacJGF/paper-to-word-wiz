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
export type DigitizeErrorCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "rate_limit"
  | "credits"
  | "invalid_response"
  | "truncated_response"
  | "gateway_error";
export type DigitizeResult =
  | { ok: true; data: DigitalizacaoExtraida }
  | { ok: false; errorCode: DigitizeErrorCode; message: string };

const SYSTEM = `Você é um OCR especializado em digitalização de questões de prova em português brasileiro.

Analise a imagem fornecida e extraia a digitalização de forma estruturada. A imagem pode conter uma questão única, um texto-base/referência seguido por vários itens numerados, OU uma montagem vertical com partes sequenciais da mesma questão.

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
- Se a imagem tiver marcadores como "Parte 1 de 3", "Parte 2 de 3", etc., leia essas partes como sequência contínua da mesma questão/referência. Não trate cada parte como uma nova questão apenas por causa do marcador.
- Se houver quebra entre partes sequenciais, junte o texto na ordem visual de cima para baixo.
- Se houver um texto, imagem, tabela ou comando que vale para vários itens, coloque isso em "referencia_texto" e NÃO repita em cada "enunciado".
- Em itens de julgamento como "julgue os próximos itens", use tipo "certo_errado", alternativas [] e crie uma questão para cada item numerado.
- Se houver vários itens numerados (ex: 86, 87, 88), cada item deve virar um objeto próprio em "questoes".
- Se houver apenas uma questão, retorne "questoes" com um único objeto.
- Preserve equações usando notação LaTeX entre cifrões: $x^2 + 2x$ inline, ou $$\\frac{a}{b}$$ em linha separada.
- Use letras gregas em LaTeX: $\\alpha$, $\\pi$, $\\Delta$.
- Frações: $\\frac{numerador}{denominador}$. Potências: $x^{2}$. Índices: $H_{2}O$. Raízes: $\\sqrt{x}$.
- Preserve a organização visual básica do texto usando marcações leves dentro das strings JSON.
- Alinhamento: envolva blocos claramente alinhados com [left]...[/left], [center]...[/center], [right]...[/right] ou [justify]...[/justify]. Se não houver segurança sobre o alinhamento, use justificado ou deixe sem marcação, pois o sistema usará justificado como padrão.
- Negrito: **texto**. Itálico: *texto*. Sublinhado: __texto__ ou <u>texto</u>.
- Sobrescrito em texto comum: ^{2} ou <sup>2</sup>. Subscrito em texto comum: _{2} ou <sub>2</sub>. Para fórmulas, prefira LaTeX entre cifrões.
- Preserve quebras de linha e parágrafos com \n. Preserve espaçamento entre blocos com linha em branco quando isso existir visualmente.
- Preserve listas com linhas iniciadas por "- " ou "1. ". Preserve tabelas em formato Markdown com pipes, por exemplo "| Coluna A | Coluna B |" e uma linha separadora "|---|---|".
- Para títulos ou trechos destacados, use negrito e, se visivelmente centralizados, [center]...[/center].
- Separe corretamente o enunciado das alternativas. Cada alternativa em um objeto próprio com letra (A, B, C, D, E) e texto.
- Se a questão for de certo/errado, use alternativas vazias [] e tipo "certo_errado".
- Se a questão for discursiva ou numérica, alternativas = [].
- tem_imagem = true se a questão contém gráfico, figura, tabela ou diagrama.
- tem_equacao = true se contém qualquer notação matemática/química.
- Retorne SOMENTE o JSON, sem markdown fora do JSON, sem explicações.`;

export const digitizeQuestion = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<DigitizeResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return digitizeFailure(
        "missing_api_key",
        "Digitalização por IA não configurada. Configure a chave LOVABLE_API_KEY no ambiente do projeto e tente novamente.",
      );
    }

    try {
      const raw = await callGeminiVision({
        apiKey,
        model: "google/gemini-2.5-flash",
        systemPrompt: SYSTEM,
        userText: "Digitalize esta questão seguindo as regras do sistema. Preserve a formatação visual básica quando ela estiver clara. Se a imagem tiver partes sequenciais, leia de cima para baixo e una o conteúdo na ordem correta.",
        imageDataUrl: data.imageDataUrl,
      });

      try {
        const parsed = extractJSON(raw) as DigitalizacaoExtraida | QuestaoExtraida;
        return { ok: true, data: normalizeDigitization(parsed) };
      } catch (e) {
        console.error("Falha ao parsear resposta da IA:", raw, e);
        return digitizeFailure("invalid_response", "A IA retornou um formato inválido. Tente novamente com uma imagem mais nítida.");
      }
    } catch (error) {
      console.error("Falha ao digitalizar questão:", error);
      return digitizeFailureFromError(error);
    }
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
    questoes: [normalizeQuestion(parsed as Partial<QuestaoExtraida>)],
  };
}

function digitizeFailure(errorCode: DigitizeErrorCode, message: string): DigitizeResult {
  return { ok: false, errorCode, message };
}

function digitizeFailureFromError(error: unknown): DigitizeResult {
  const text = errorMessage(error);
  const lower = text.toLowerCase();

  if (lower.includes("401") || lower.includes("403")) {
    return digitizeFailure("invalid_api_key", "A chave de IA está inválida ou sem permissão. Verifique a LOVABLE_API_KEY e tente novamente.");
  }
  if (lower.includes("429")) {
    return digitizeFailure("rate_limit", "Limite de IA atingido. Aguarde alguns instantes e tente novamente.");
  }
  if (lower.includes("402")) {
    return digitizeFailure("credits", "Créditos de IA esgotados. Adicione créditos no workspace e tente novamente.");
  }
  if (lower.includes("truncada") || lower.includes("truncated")) {
    return digitizeFailure("truncated_response", "A resposta da IA foi muito longa. Tente uma imagem com menos conteúdo ou divida em partes menores.");
  }

  return digitizeFailure("gateway_error", "Falha ao digitalizar. Verifique a imagem e tente novamente.");
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
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
