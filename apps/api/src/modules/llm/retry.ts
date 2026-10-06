import { LlmUnavailableError } from './domain/errors';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Repete só falhas de disponibilidade (rede, 5xx), com backoff exponencial. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 500;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const retryable = error instanceof LlmUnavailableError;
      if (!retryable || attempt >= attempts - 1) throw error;
      await sleep(baseMs * 2 ** attempt);
    }
  }
}
