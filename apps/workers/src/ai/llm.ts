/**
 * The two free hosted models (design: "Free AI"):
 *  - Groq (Llama) for short live insights during class.
 *  - Gemini Flash for the after-class summary.
 * Both are optional; callers fall back to rule-written text when a key is missing or a call fails.
 */
import { env } from "../env";

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<unknown>;
}

/** Asks Groq for a JSON object. Returns null if Groq isn't configured or the call fails. */
export async function groqJson<T>(system: string, user: string): Promise<T | null> {
  if (!env.groqApiKey) return null;
  try {
    const data = (await post(
      "https://api.groq.com/openai/v1/chat/completions",
      { authorization: `Bearer ${env.groqApiKey}` },
      {
        model: env.groqModel,
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      20_000,
    )) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    return text ? (JSON.parse(text) as T) : null;
  } catch (e) {
    console.warn("[groq]", (e as Error).message);
    return null;
  }
}

/** Asks Gemini for text. Returns null if Gemini isn't configured or the call fails. */
export async function geminiText(prompt: string): Promise<string | null> {
  if (!env.geminiApiKey) return null;
  try {
    const data = (await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent`,
      { "x-goog-api-key": env.geminiApiKey },
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1200, thinkingConfig: { thinkingBudget: 0 } },
      },
      60_000,
    )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    return text || null;
  } catch (e) {
    console.warn("[gemini]", (e as Error).message);
    return null;
  }
}
