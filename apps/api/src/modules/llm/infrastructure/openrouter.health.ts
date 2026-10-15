import type { LlmHealth } from '../domain/llm-health.port';

export interface OpenRouterKeyApi {
  get(path: string, options?: { signal?: AbortSignal }): Promise<unknown>;
}

const CACHE_MS = 60_000;

/** `GET /key` confere a chave sem gastar cota de modelo; um sucesso vale por 60 s. */
export class OpenRouterHealth implements LlmHealth {
  readonly unavailableMessage =
    'Não consegui usar a OpenRouter. Confira a OPENROUTER_API_KEY e a conexão com a internet.';
  private okUntil = 0;

  constructor(private readonly client: OpenRouterKeyApi) {}

  async ping(): Promise<boolean> {
    if (Date.now() < this.okUntil) return true;
    try {
      await this.client.get('/key', { signal: AbortSignal.timeout(3000) });
      this.okUntil = Date.now() + CACHE_MS;
      return true;
    } catch {
      return false;
    }
  }
}
