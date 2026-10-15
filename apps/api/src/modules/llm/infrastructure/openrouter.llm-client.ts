import { LlmRequestError } from '../domain/errors';
import type { LlmClient, LlmRequest } from '../domain/llm-client.port';
import { mapOpenAiError, OPENROUTER } from './openai.errors';

interface ChatChunk {
  choices: { delta?: { content?: string | null } }[];
  /** A OpenRouter manda o erro dentro do stream quando o provedor cai depois do primeiro token. */
  error?: { message: string };
}

/** O pedaço do SDK que o adapter usa (chat completions com streaming). */
export interface OpenRouterChatApi {
  chat: {
    completions: {
      create(
        body: {
          model: string;
          messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
          temperature?: number;
          max_tokens?: number;
          stream: true;
        },
        options?: { signal?: AbortSignal },
      ): Promise<AsyncIterable<ChatChunk>>;
    };
  };
}

export interface OpenRouterLlmClientConfig {
  model: string;
}

/**
 * Geração pela OpenRouter. Usa chat completions, o formato que todos os modelos de lá aceitam;
 * os modelos abertos gratuitos respeitam `temperature` e `max_tokens`.
 */
export class OpenRouterLlmClient implements LlmClient {
  readonly model: string;

  constructor(
    private readonly client: OpenRouterChatApi,
    config: OpenRouterLlmClientConfig,
  ) {
    this.model = config.model;
  }

  async complete(req: LlmRequest, signal?: AbortSignal): Promise<string> {
    let text = '';
    for await (const piece of this.stream(req, signal)) text += piece;
    return text;
  }

  async *stream(req: LlmRequest, signal?: AbortSignal): AsyncIterable<string> {
    try {
      const chunks = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: [{ role: 'system', content: req.system }, ...req.messages],
          ...(req.temperature === undefined ? {} : { temperature: req.temperature }),
          ...(req.maxTokens === undefined ? {} : { max_tokens: req.maxTokens }),
          stream: true,
        },
        { signal },
      );
      for await (const chunk of chunks) {
        if (chunk.error) throw new LlmRequestError('A geração da resposta falhou na OpenRouter.');
        const content = chunk.choices[0]?.delta?.content;
        if (content) yield content;
      }
    } catch (error) {
      throw mapOpenAiError(error, OPENROUTER);
    }
  }
}
