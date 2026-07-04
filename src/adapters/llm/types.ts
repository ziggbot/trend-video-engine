export interface LlmJsonRequest {
  system?: string;
  prompt: string;
  /** Rough upper bound on response size. */
  maxOutputTokens?: number;
  temperature?: number;
}

export interface LlmProvider {
  id: string;
  /** Complete a prompt and return the raw text of the model's JSON answer. */
  completeJson(req: LlmJsonRequest): Promise<string>;
}
