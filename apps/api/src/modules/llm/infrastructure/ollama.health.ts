import type { LlmHealth } from '../domain/llm-health.port';

export class OllamaHealth implements LlmHealth {
  readonly unavailableMessage =
    'O Ollama não está respondendo. Verifique se ele está rodando (ollama serve).';

  constructor(private readonly baseUrl: string) {}

  /** Nunca lança: qualquer falha vira `false`. */
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
