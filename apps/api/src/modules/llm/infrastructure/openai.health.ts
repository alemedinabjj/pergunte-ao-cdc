import type { LlmHealth } from '../domain/llm-health.port';

export interface OpenAiModelsApi {
  models: { retrieve(model: string, options?: { signal?: AbortSignal }): Promise<unknown> };
}

const CACHE_MS = 60_000;

/** Consulta o modelo configurado; um sucesso vale por 60 s para não somar latência a cada pergunta. */
export class OpenAiHealth implements LlmHealth {
  readonly unavailableMessage =
    'Não consegui usar a API da OpenAI. Confira a OPENAI_API_KEY e a conexão com a internet.';
  private okUntil = 0;

  constructor(
    private readonly client: OpenAiModelsApi,
    private readonly model: string,
  ) {}

  async ping(): Promise<boolean> {
    if (Date.now() < this.okUntil) return true;
    try {
      await this.client.models.retrieve(this.model, { signal: AbortSignal.timeout(3000) });
      this.okUntil = Date.now() + CACHE_MS;
      return true;
    } catch {
      return false;
    }
  }
}
