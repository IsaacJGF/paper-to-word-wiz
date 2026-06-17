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
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${body}`);
  }
  const json = await res.json() as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content ?? "";
}
