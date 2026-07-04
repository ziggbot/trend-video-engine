import { z } from 'zod';
import { LlmProvider } from './types';
import { stripCodeFences } from '../../lib/text';

/**
 * Ask the LLM for JSON matching a schema; on parse/validation failure, retry once
 * with the error message appended (self-repair), then give up.
 */
export async function completeStructured<S extends z.ZodTypeAny>(
  llm: LlmProvider,
  schema: S,
  req: { system?: string; prompt: string; maxOutputTokens?: number; temperature?: number }
): Promise<z.infer<S>> {
  const attempt = async (prompt: string) => {
    const raw = await llm.completeJson({ ...req, prompt });
    const parsed = JSON.parse(stripCodeFences(raw));
    return schema.parse(parsed);
  };

  try {
    return await attempt(req.prompt);
  } catch (err) {
    const detail = err instanceof Error ? err.message.slice(0, 500) : String(err);
    const repairPrompt = `${req.prompt}\n\nYour previous answer was invalid JSON for the required schema (${detail}). Respond again with ONLY valid JSON matching the requirements.`;
    return attempt(repairPrompt);
  }
}
