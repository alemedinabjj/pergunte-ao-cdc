export const LLM_CLIENT = Symbol('LLM_CLIENT');

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LlmClient {
  readonly model: string;
  complete(req: LlmRequest, signal?: AbortSignal): Promise<string>;
  stream(req: LlmRequest, signal?: AbortSignal): AsyncIterable<string>;
}
