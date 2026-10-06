export class OllamaHealth {
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
