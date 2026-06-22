import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callLovableTextJSON } from "@/lib/ai-gateway.server";
import type { DeepAnalysisPayload, DeepAnalysisReport, DeepPattern } from "@/lib/prova-deep-analysis";

const Input = z.object({
  payload: z.any(),
});

type DeepAnalysisResult =
  | { ok: true; report: DeepAnalysisReport; model: string }
  | { ok: false; errorCode: string; message: string };

const DEFAULT_ANALYSIS_MODEL = "google/gemini-2.5-flash";

export const generateDeepAnalysis = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<DeepAnalysisResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        errorCode: "missing_api_key",
        message: "Análise profunda por IA não configurada. Ela usa a mesma chave da digitalização: LOVABLE_API_KEY.",
      };
    }

    const model = process.env.LOVABLE_ANALYSIS_MODEL || DEFAULT_ANALYSIS_MODEL;

    try {
      const payload = sanitizePayload(data.payload as DeepAnalysisPayload);
      const raw = await callLovableTextJSON({
        apiKey,
        model,
        systemPrompt: SYSTEM_PROMPT,
        userText: JSON.stringify(payload),
        maxTokens: 8192,
      });

      try {
        const parsed = extractJSON(raw) as Partial<DeepAnalysisReport>;
        return { ok: true, report: normalizeReport(parsed), model };
      } catch (parseError) {
        console.error("Falha ao parsear análise profunda por IA:", raw, parseError);
        return {
          ok: false,
          errorCode: "invalid_response",
          message: "A IA retornou uma resposta em formato inválido. Tente novamente com menos questões ou filtros mais específicos.",
        };
      }
    } catch (error) {
      console.error("Falha ao gerar análise profunda pelo Lovable AI Gateway:", error);
      return failureFromGatewayError(error);
    }
  });

const SYSTEM_PROMPT = `Você é um analista pedagógico de provas de Física.

Objetivo: analisar apenas os dados estruturados enviados pelo sistema e produzir uma análise profunda, com evidências, sobre padrões de cobrança, linguagem, construção dos itens, uso de texto-base e recomendações de simulado.

Regras obrigatórias:
- Use apenas os dados enviados pelo sistema.
- Não invente conteúdos, anos, bancas, tendências ou padrões.
- Não use conhecimento externo sobre a banca.
- Não afirme tendência histórica quando houver apenas um ano analisado.
- Não afirme padrão forte com poucas questões.
- Diferencie padrão observado de hipótese provável.
- Cite evidências da base analisada.
- Avise quando a amostra for pequena.
- Avise quando houver muitos dados incompletos.
- Avise quando questões com imagem puderem limitar a análise.
- Não crie conclusões genéricas sem base nos dados.
- Se uma conclusão depender de poucos exemplos, use confiança baixa ou média.

Analise:
- padrões de cobrança;
- tipo de raciocínio exigido;
- interpretação, cálculo direto, análise qualitativa ou raciocínio em etapas;
- uso de referências/textos-base;
- conteúdos diretos e indiretos;
- temas misturados;
- comandos característicos;
- construção dos itens;
- padrões sutis não evidentes nos gráficos;
- recomendações para montar simulado semelhante.

Responda APENAS um JSON válido no formato abaixo, sem markdown, sem texto antes e sem texto depois:

{
  "aviso_amostra": "",
  "visao_geral": "",
  "padroes_conteudo": [
    { "titulo": "", "explicacao": "", "evidencia": "", "nivel_confianca": "baixo" }
  ],
  "padroes_linguagem": [],
  "padroes_construcao_itens": [],
  "uso_texto_base": "",
  "padroes_sutis": [],
  "recomendacoes_simulado": [],
  "limitacoes": [],
  "evidencias_usadas": []
}

O campo nivel_confianca deve ser exatamente: "baixo", "médio" ou "alto".`;

function failureFromGatewayError(error: unknown): DeepAnalysisResult {
  const text = error instanceof Error ? error.message : String(error);
  const lower = text.toLowerCase();

  if (lower.includes("401") || lower.includes("403")) {
    return {
      ok: false,
      errorCode: "invalid_api_key",
      message: "A chave da IA está inválida ou sem permissão. Verifique a LOVABLE_API_KEY usada na digitalização.",
    };
  }
  if (lower.includes("429")) {
    return {
      ok: false,
      errorCode: "rate_limit",
      message: "Limite de IA atingido. Aguarde alguns instantes e tente novamente.",
    };
  }
  if (lower.includes("402") || lower.includes("credits")) {
    return {
      ok: false,
      errorCode: "credits",
      message: "Créditos de IA esgotados no Lovable AI Gateway.",
    };
  }
  if (lower.includes("truncada") || lower.includes("truncated")) {
    return {
      ok: false,
      errorCode: "truncated_response",
      message: "A resposta da IA foi muito longa. Use filtros mais específicos ou reduza a quantidade de questões.",
    };
  }

  return {
    ok: false,
    errorCode: "gateway_error",
    message: "Falha ao gerar análise profunda usando a mesma IA da digitalização.",
  };
}

function sanitizePayload(payload: DeepAnalysisPayload): DeepAnalysisPayload {
  const questions = Array.isArray(payload.lista_questoes_analisadas) ? payload.lista_questoes_analisadas : [];
  return {
    ...payload,
    lista_questoes_analisadas: questions.map((question) => ({
      ...question,
      referencia_texto_base: limitText(asString(question.referencia_texto_base), 3500),
      enunciado: limitText(asString(question.enunciado), 3500),
      alternativas: Array.isArray(question.alternativas)
        ? question.alternativas.map((alt) => ({ ...alt, texto: limitText(asString(alt.texto), 1200) }))
        : [],
      possui_imagem: Boolean(question.possui_imagem),
      possui_equacao: Boolean(question.possui_equacao),
    })),
  };
}

function normalizeReport(report: Partial<DeepAnalysisReport>): DeepAnalysisReport {
  return {
    aviso_amostra: asString(report.aviso_amostra),
    visao_geral: asString(report.visao_geral),
    padroes_conteudo: normalizePatterns(report.padroes_conteudo),
    padroes_linguagem: normalizePatterns(report.padroes_linguagem),
    padroes_construcao_itens: normalizePatterns(report.padroes_construcao_itens),
    uso_texto_base: asString(report.uso_texto_base),
    padroes_sutis: normalizePatterns(report.padroes_sutis),
    recomendacoes_simulado: normalizePatterns(report.recomendacoes_simulado),
    limitacoes: normalizeStringArray(report.limitacoes),
    evidencias_usadas: normalizeStringArray(report.evidencias_usadas),
  };
}

function normalizePatterns(value: unknown): DeepPattern[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const pattern = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const confidence = asString(pattern.nivel_confianca);
    return {
      titulo: asString(pattern.titulo),
      explicacao: asString(pattern.explicacao),
      evidencia: asString(pattern.evidencia),
      nivel_confianca: confidence === "alto" || confidence === "médio" || confidence === "baixo" ? confidence : "baixo",
    };
  }).filter((pattern) => pattern.titulo || pattern.explicacao || pattern.evidencia);
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(asString).filter(Boolean) : [];
}

function limitText(value: string, max: number) {
  return value.slice(0, max);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
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
