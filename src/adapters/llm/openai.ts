import { LlmJsonRequest, LlmProvider } from './types.js';
import { fetchJson } from '../../lib/http.js';
import { withRetry } from '../../lib/retry.js';

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/**
 * Optional paid fallback. Only used when LLM_PROVIDER=openai is set explicitly —
 * the default stack is free-tier only.
 */
export class OpenAiProvider implements LlmProvider {
  id = 'openai';

  constructor(
    private apiKey: string,
    private model = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini'
  ) {}

  async completeJson(req: LlmJsonRequest): Promise<string> {
    const res = await withRetry(
      () =>
        fetchJson<OpenAiResponse>(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
            body: JSON.stringify({
              model: this.model,
              response_format: { type: 'json_object' },
              temperature: req.temperature ?? 0.8,
              max_tokens: req.maxOutputTokens ?? 4096,
              messages: [
                ...(req.system ? [{ role: 'system', content: req.system }] : []),
                { role: 'user', content: req.prompt }
              ]
            })
          },
          60_000
        ),
      { attempts: 3, baseDelayMs: 3000 }
    );
    const text = res.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) throw new Error('OpenAI returned empty response');
    return text;
  }
}
