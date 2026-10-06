import Anthropic from '@anthropic-ai/sdk';
import { LlmRequestError, LlmUnavailableError } from '../domain/errors';
import type { LlmClient, LlmRequest } from '../domain/llm-client.port';

export interface AnthropicLlmClientConfig {
  apiKey: string;
  model: string;
}

/**
 * Claude via SDK oficial. Diferenças em relação ao Ollama:
 * - não envia `temperature` (os modelos atuais rejeitam sampling com 400);
 * - o pensamento é sempre ligado nesses modelos e conta no `max_tokens`, por isso o teto é alto
 *   e o tamanho da resposta é controlado pelo prompt;
 * - `fallbacks: "default"` refaz no servidor uma requisição recusada pelos classificadores.
 */
export class AnthropicLlmClient implements LlmClient {
  readonly model: string;
  private readonly client: Anthropic;

  constructor(config: AnthropicLlmClientConfig) {
    this.model = config.model;
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async complete(req: LlmRequest, signal?: AbortSignal): Promise<string> {
    let text = '';
    for await (const piece of this.stream(req, signal)) text += piece;
    return text;
  }

  async *stream(req: LlmRequest, signal?: AbortSignal): AsyncIterable<string> {
    try {
      const stream = this.client.beta.messages.stream(
        {
          model: this.model,
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'low' },
          system: req.system,
          messages: req.messages,
        },
        { signal },
      );
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') {
        throw new LlmRequestError('O modelo recusou responder a esta pergunta.');
      }
    } catch (error) {
      throw mapAnthropicError(error);
    }
  }
}

function mapAnthropicError(error: unknown): unknown {
  if (error instanceof Anthropic.APIUserAbortError) {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    return abort;
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new LlmUnavailableError('Não consegui falar com a API da Anthropic.', { cause: error });
  }
  if (error instanceof Anthropic.APIError) {
    const status = error.status ?? 0;
    if (status === 429 || status >= 500) {
      return new LlmUnavailableError(`API da Anthropic indisponível (${status}).`, {
        cause: error,
      });
    }
    return new LlmRequestError(`API da Anthropic recusou a requisição (${status}).`, {
      cause: error,
    });
  }
  return error;
}
