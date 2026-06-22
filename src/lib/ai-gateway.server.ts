// Server-only helper to call Lovable AI Gateway
export async function callGeminiVision(opts: {
  apiKey: string;
  model?: string;
  systemPrompt: string;
  userText: string;
  imageDataUrl: string;
}): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": opts.apiKey,
    },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: opts.systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: opts.userText },
            { type: "image_url", image_url: { url: opts.imageDataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 8192,
    }),
  });
  return readGatewayResponse(res);
}

export async function callLovableTextJSON(opts: {
  apiKey: string;
  model?: string;
  systemPrompt: string;
  userText: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": opts.apiKey,
    },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userText },
      ],
      response_format: { type: "json_object" },
      max_tokens: opts.maxTokens ?? 8192,
    }),
  });
  return readGatewayResponse(res);
}

async function readGatewayResponse(res: Response) {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${body}`);
  }
  const json = await res.json() as {
    choices: { message: { content: string }; finish_reason?: string }[];
  };
  const choice = json.choices[0];
  if (choice?.finish_reason === "length") {
    throw new Error("A resposta da IA foi truncada. Tente reduzir a quantidade de conteúdo enviado.");
  }
  return choice?.message?.content ?? "";
}
