type DeepPattern = {
  titulo: string;
  explicacao: string;
  evidencia: string;
  nivel_confianca: "baixo" | "médio" | "alto";
};

type DeepAnalysisReport = {
  aviso_amostra: string;
  visao_geral: string;
  padroes_conteudo: DeepPattern[];
  padroes_linguagem: DeepPattern[];
  padroes_construcao_itens: DeepPattern[];
  uso_texto_base: string;
  padroes_sutis: DeepPattern[];
  recomendacoes_simulado: DeepPattern[];
  limitacoes: string[];
  evidencias_usadas: string[];
};

type DeepAnalysisResult =
  | { ok: true; report: DeepAnalysisReport; model: string }
  | { ok: false; errorCode: string; message: string };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_OPENAI_ANALYSIS_MODEL = "gpt-4o-mini";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, errorCode: "method_not_allowed", message: "Método não permitido." }, 405);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return jsonResponse({
      ok: false,
      errorCode: "missing_api_key",
      message: "Análise profunda por IA não configurada. Configure OPENAI_API_KEY nos secrets da Supabase Edge Function.",
    });
  }

  let payload: unknown;
  try {
    const body = await req.json();
    payload = body?.payload;
  } catch (_error) {
    return jsonResponse({ ok: false, errorCode: "invalid_request", message: "Requisição inválida. Envie um JSON com o campo payload." }, 400);
  }

  if (!payload || typeof payload !== "object") {
    return jsonResponse({ ok: false, errorCode: "invalid_payload", message: "Payload da análise não encontrado." }, 400);
  }

  const model = Deno.env.get("OPENAI_ANALYSIS_MODEL") || DEFAULT_OPENAI_ANALYSIS_MODEL;
  const sanitizedPayload = sanitizePayload(payload as Record<string, unknown>);

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
                text: JSON.stringify(sanitizedPayload),
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
      return jsonResponse({
        ok: false,
        errorCode: "openai_error",
        message: extractOpenAIErrorMessage(body) || "Falha ao gerar análise profunda pela OpenAI.",
      });
    }

    const text = extractOutputText(body);
    if (!text) {
      console.error("Resposta OpenAI sem texto estruturado:", body);
      return jsonResponse({ ok: false, errorCode: "invalid_response", message: "A OpenAI retornou uma resposta vazia ou em formato inesperado." });
    }

    const parsed = JSON.parse(text) as DeepAnalysisReport;
    return jsonResponse({ ok: true, report: normalizeReport(parsed), model });
  } catch (error) {
    console.error("Falha ao gerar análise profunda:", error);
    return jsonResponse({
      ok: false,
      errorCode: "unexpected_error",
      message: error instanceof Error ? error.message : "Não foi possível processar a resposta da OpenAI.",
    });
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

function sanitizePayload(payload: Record<string, unknown>) {
  const questions = Array.isArray(payload.lista_questoes_analisadas) ? payload.lista_questoes_analisadas : [];
  return {
    ...payload,
    lista_questoes_analisadas: questions.map((question) => sanitizeQuestion(question)),
  };
}

function sanitizeQuestion(value: unknown) {
  const question = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const alternativas = Array.isArray(question.alternativas) ? question.alternativas : [];
  return {
    ...question,
    referencia_texto_base: limitText(asString(question.referencia_texto_base)),
    enunciado: limitText(asString(question.enunciado)),
    alternativas: alternativas.map((alt) => {
      const item = alt && typeof alt === "object" ? alt as Record<string, unknown> : {};
      return { ...item, texto: limitText(asString(item.texto), 1200) };
    }),
    possui_imagem: Boolean(question.possui_imagem),
    possui_equacao: Boolean(question.possui_equacao),
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
  });
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(asString).filter(Boolean) : [];
}

function limitText(value: string, max = 3500) {
  return value.slice(0, max);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
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

function jsonResponse(body: DeepAnalysisResult | { ok: false; errorCode: string; message: string }, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
