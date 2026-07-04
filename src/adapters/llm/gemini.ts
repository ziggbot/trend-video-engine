import { LlmJsonRequest, LlmProvider } from './types.js';
import { fetchJson } from '../../lib/http.js';
import { withRetry } from '../../lib/retry.js';

const DEFAULT_MODEL = 'gemini-2.5-flash';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
}

/**
 * Google Generative Language API (free tier — API key without billing).
 * Uses responseMimeType: application/json to force JSON output.
 */
export class GeminiProvider implements LlmProvider {
  id = 'gemini';

  constructor(
    private apiKey: string,
    private model = process.env.GEMINI_MODEL || DEFAULT_MODEL
  ) {}

  async completeJson(req: LlmJsonRequest): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    const body = {
      ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: req.temperature ?? 0.8,
        maxOutputTokens: req.maxOutputTokens ?? 4096
      }
    };
    const res = await withRetry(
      () =>
        fetchJson<GeminiResponse>(
          url,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
            body: JSON.stringify(body)
          },
          60_000
        ),
      { attempts: 3, baseDelayMs: 3000 }
    );
    const text = res.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text.trim()) {
      throw new Error(`Gemini returned empty response (finishReason: ${res.candidates?.[0]?.finishReason})`);
    }
    return text;
  }
}
