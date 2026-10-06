import { z } from 'zod';
import { LlmRequestError } from '../domain/errors';
import type { LlmClient, LlmRequest } from '../domain/llm-client.port';
import { parseNdjson } from './ndjson';
import { ollamaPost } from './ollama-http';

const chatChunkSchema = z.object({
  message: z.object({ content: z.string() }).optional(),
  done: z.boolean().optional(),
  error: z.string().optional(),
});

export interface OllamaLlmClientConfig {
  baseUrl: string;
  model: string;
}

export class OllamaLlmClient implements LlmClient {
  readonly model: string;

  constructor(private readonly config: OllamaLlmClientConfig) {
    this.model = config.model;
  }

  async complete(req: LlmRequest, signal?: AbortSignal): Promise<string> {
    const response = await this.post(req, false, signal);
    const chunk = chatChunkSchema.parse(await response.json());
    if (chunk.error) throw new LlmRequestError(chunk.error);
    return chunk.message?.content ?? '';
  }

  async *stream(req: LlmRequest, signal?: AbortSignal): AsyncIterable<string> {
    const response = await this.post(req, true, signal);
    if (!response.body) throw new LlmRequestError('Ollama respondeu sem corpo');
    for await (const raw of parseNdjson(response.body)) {
      const chunk = chatChunkSchema.parse(raw);
      if (chunk.error) throw new LlmRequestError(chunk.error);
      if (chunk.message?.content) yield chunk.message.content;
      if (chunk.done) return;
    }
  }

  private post(req: LlmRequest, stream: boolean, signal?: AbortSignal): Promise<Response> {
    const options: Record<string, number> = {};
    if (req.temperature !== undefined) options.temperature = req.temperature;
    if (req.maxTokens !== undefined) options.num_predict = req.maxTokens;
    return ollamaPost(
      this.config.baseUrl,
      '/api/chat',
      {
        model: this.model,
        stream,
        messages: [{ role: 'system', content: req.system }, ...req.messages],
        options,
      },
      this.model,
      signal,
    );
  }
}
