import type { LlmHealth } from '../domain/llm-health.port';

/** Junta os provedores em uso (ex.: embeddings num, geração noutro). */
export class CompositeHealth implements LlmHealth {
  private lastFailure = '';

  constructor(private readonly parts: LlmHealth[]) {}

  get unavailableMessage(): string {
    return this.lastFailure;
  }

  async ping(): Promise<boolean> {
    const results = await Promise.all(this.parts.map((part) => part.ping()));
    const failed = this.parts.find((_, index) => !results[index]);
    this.lastFailure = failed?.unavailableMessage ?? '';
    return failed === undefined;
  }
}
