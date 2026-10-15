import OpenAI from 'openai';
import { LlmRequestError, LlmUnavailableError } from '../domain/errors';

/** Quem está do outro lado do SDK: a própria OpenAI ou um serviço compatível (OpenRouter). */
export interface OpenAiCompatibleProvider {
  name: string;
  keyVar: string;
  rateLimitMessage?: string;
}

export const OPENAI: OpenAiCompatibleProvider = { name: 'OpenAI', keyVar: 'OPENAI_API_KEY' };

export const OPENROUTER: OpenAiCompatibleProvider = {
  name: 'OpenRouter',
  keyVar: 'OPENROUTER_API_KEY',
  // Nos modelos gratuitos o 429 quase sempre é a cota diária da conta, não um pico passageiro.
  rateLimitMessage:
    'O site atingiu o limite de uso do modelo gratuito por enquanto. Tente de novo mais tarde.',
};

/** Traduz erros do SDK da OpenAI para os erros do domínio. */
export function mapOpenAiError(
  error: unknown,
  provider: OpenAiCompatibleProvider = OPENAI,
): unknown {
  if (error instanceof OpenAI.APIUserAbortError) {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    return abort;
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new LlmUnavailableError(`Não consegui falar com a API da ${provider.name}.`, {
      cause: error,
    });
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return new LlmUnavailableError(
      `A ${provider.name} recusou a chave. Confira a ${provider.keyVar}.`,
      { cause: error },
    );
  }
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 0;
    if (status === 429 && provider.rateLimitMessage) {
      return new LlmUnavailableError(provider.rateLimitMessage, { cause: error });
    }
    if (status === 429 || status >= 500) {
      return new LlmUnavailableError(`API da ${provider.name} indisponível (${status}).`, {
        cause: error,
      });
    }
    return new LlmRequestError(`API da ${provider.name} recusou a requisição (${status}).`, {
      cause: error,
    });
  }
  return error;
}
