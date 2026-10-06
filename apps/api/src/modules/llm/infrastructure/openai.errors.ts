import OpenAI from 'openai';
import { LlmRequestError, LlmUnavailableError } from '../domain/errors';

/** Traduz erros do SDK da OpenAI para os erros do domínio. */
export function mapOpenAiError(error: unknown): unknown {
  if (error instanceof OpenAI.APIUserAbortError) {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    return abort;
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new LlmUnavailableError('Não consegui falar com a API da OpenAI.', { cause: error });
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return new LlmUnavailableError('A OpenAI recusou a chave. Confira a OPENAI_API_KEY.', {
      cause: error,
    });
  }
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 0;
    if (status === 429 || status >= 500) {
      return new LlmUnavailableError(`API da OpenAI indisponível (${status}).`, { cause: error });
    }
    return new LlmRequestError(`API da OpenAI recusou a requisição (${status}).`, { cause: error });
  }
  return error;
}
