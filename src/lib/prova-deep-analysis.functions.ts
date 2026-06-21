import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DeepAnalysisPayload, DeepAnalysisReport } from "@/lib/prova-deep-analysis";

const DEFAULT_OPENAI_ANALYSIS_MODEL = "gpt-5.5";

const Input = z.object({
  payload: z.any(),
});

const PatternSchema = z.object({
  titulo: z.string(),
  explicacao: z.string(),
  evidencia: z.string(),
  nivel_confianca: z.enum(["baixo", "médio", "alto"]),
});

const DeepAnalysisReportSchema = z.object({
  aviso_amostra: z.string(),
  visao_geral: z.string(),
  padroes_conteudo: z.array(PatternSchema),
  padroes_linguagem: z.array(PatternSchema),
  padroes_construcao_itens: z.array(PatternSchema),
  uso_texto_base: z.string(),
  padroes_sutis: z.array(PatternSchema),
  recomendacoes_simulado: z.array(PatternSchema),
  limitacoes: z.array(z.string()),
  evidencias_usadas: z.array(z.string()),
});

export type DeepAnalysisErrorCode =
  | "missing_api_key"
  | "openai_error"
  | "invalid_response";

export type GenerateDeepAnalysisResult =
  | { ok: true; report: DeepAnalysisReport; model: string }
  | { ok: false; errorCode: DeepAnalysisErrorCode; message: string };

export const generateDeepProvaAnalysis = createServerFn({ method: "POST" })
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<GenerateDeepAnalysisResult> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        errorCode: "missing_api_key",
        message: "Análise profunda por IA não configurada. Configure OPENAI_API_KEY no ambiente do backend.",
      };
    }

    const model = process.env.OPENAI_ANALYSIS_MODEL || DEFAULT_OPENAI_ANALYSIS_MODEL;
    const payload = sanitizePayload(data.payload as DeepAnalysisPayload);

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          store: false,
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: SYSTEM_PROMPT,
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: JSON.stringify(payload),
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "analise_profunda_prova",
              strict: true,
              schema: REPORT_JSON_SCHEMA,
            },
          },
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        console.error("Erro OpenAI na análise profunda:", body);
        return {
          ok: false,
          errorCode: "openai_error",
          message: extractOpenAIErrorMessage(body) || "Falha ao gerar análise profunda pela OpenAI.",
        };
      }

      const text = extractOutputText(body);
      if (!text) {
        console.error("Resposta OpenAI sem texto estruturado:", body);
        return {
          ok: false,
          errorCode: "invalid_response",
          message: "A OpenAI retornou uma resposta vazia ou em formato inesperado.",
        };
      }

      const parsed = DeepAnalysisReportSchema.parse(JSON.parse(text)) as DeepAnalysisReport;
      return { ok: true, report: parsed, model };
    } catch (error) {
      console.error("Falha ao gerar análise profunda:", error);
      return {
        ok: false,
        errorCode: "invalid_response",
        message: error instanceof Error ? error.message : "Não foi possível processar a resposta da OpenAI.",
      };
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

Responda somente no JSON do schema solicitado.`;

const REPORT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "aviso_amostra",
    "visao_geral",
    "padroes_conteudo",
    "padroes_linguagem",
    "padroes_construcao_itens",
    "uso_texto_base",
    "padroes_sutis",
    "recomendacoes_simulado",
    "limitacoes",
    "evidencias_usadas",
  ],
  properties: {
    aviso_amostra: { type: "string" },
    visao_geral: { type: "string" },
    padroes_conteudo: { type: "array", items: patternJsonSchema() },
    padroes_linguagem: { type: "array", items: patternJsonSchema() },
    padroes_construcao_itens: { type: "array", items: patternJsonSchema() },
    uso_texto_base: { type: "string" },
    padroes_sutis: { type: "array", items: patternJsonSchema() },
    recomendacoes_simulado: { type: "array", items: patternJsonSchema() },
    limitacoes: { type: "array", items: { type: "string" } },
    evidencias_usadas: { type: "array", items: { type: "string" } },
  },
};

function patternJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["titulo", "explicacao", "evidencia", "nivel_confianca"],
    properties: {
      titulo: { type: "string" },
      explicacao: { type: "string" },
      evidencia: { type: "string" },
      nivel_confianca: { type: "string", enum: ["baixo", "médio", "alto"] },
    },
  };
}

function sanitizePayload(payload: DeepAnalysisPayload): DeepAnalysisPayload {
  return {
    ...payload,
    lista_questoes_analisadas: (payload.lista_questoes_analisadas ?? []).map((question) => ({
      ...question,
      referencia_texto_base: limitText(question.referencia_texto_base),
      enunciado: limitText(question.enunciado),
      alternativas: (question.alternativas ?? []).map((alt) => ({ ...alt, texto: limitText(alt.texto, 1200) })),
      possui_imagem: Boolean(question.possui_imagem),
      possui_equacao: Boolean(question.possui_equacao),
    })),
  };
}

function limitText(value: string | null | undefined, max = 3500) {
  return (value ?? "").slice(0, max);
}

function extractOutputText(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const data = response as { output_text?: unknown; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (typeof data.output_text === "string") return data.output_text;

  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }

  return null;
}

function extractOpenAIErrorMessage(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : null;
}
