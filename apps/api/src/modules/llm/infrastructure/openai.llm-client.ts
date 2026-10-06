import { LlmRequestError } from '../domain/errors';
import type { ChatMessage, LlmClient, LlmRequest } from '../domain/llm-client.port';
import { mapOpenAiError } from './openai.errors';

/** O pedaço do SDK que o adapter usa (Responses API com streaming). */
export interface OpenAiResponsesApi {
  responses: {
    create(
      body: {
        model: string;
        instructions: string;
        input: ChatMessage[];
        reasoning: { effort: 'low' };
        stream: true;
      },
      options?: { signal?: AbortSignal },
    ): Promise<AsyncIterable<{ type: string }>>;
  };
}

export interface OpenAiLlmClientConfig {
  model: string;
}

/**
 * Geração pela Responses API. Os modelos atuais da OpenAI raciocinam antes de responder,
 * então não enviamos `temperature` e o tamanho da resposta é controlado pelo prompt.
 */
export class OpenAiLlmClient implements LlmClient {
  readonly model: string;

  constructor(
    private readonly client: OpenAiResponsesApi,
    config: OpenAiLlmClientConfig,
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
      const events = await this.client.responses.create(
        {
          model: this.model,
          instructions: req.system,
          input: req.messages,
          reasoning: { effort: 'low' },
          stream: true,
        },
        { signal },
      );
      for await (const event of events) {
        if (event.type === 'response.output_text.delta' && 'delta' in event) {
          if (typeof event.delta === 'string') yield event.delta;
        } else if (event.type === 'response.failed' || event.type === 'error') {
          throw new LlmRequestError('A geração da resposta falhou na OpenAI.');
        }
      }
    } catch (error) {
      throw mapOpenAiError(error);
    }
  }
}
