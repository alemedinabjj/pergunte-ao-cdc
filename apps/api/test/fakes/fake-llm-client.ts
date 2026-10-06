import { LlmRequestError } from '../../src/modules/llm/domain/errors';
import type { LlmClient, LlmRequest } from '../../src/modules/llm/domain/llm-client.port';

export interface FakeLlmOptions {
  completions?: string[];
  chunks?: string[];
  /** Lança LlmRequestError depois de emitir esse número de chunks. */
  failAfter?: number;
  /** Espera entre chunks, para testar abort. */
  delayMs?: number;
}

function abortError(): Error {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}

export class FakeLlmClient implements LlmClient {
  readonly model = 'fake-llm';
  readonly requests: LlmRequest[] = [];
  private readonly completions: string[];

  constructor(private readonly options: FakeLlmOptions = {}) {
    this.completions = [...(options.completions ?? [])];
  }

  async complete(req: LlmRequest): Promise<string> {
    this.requests.push(req);
    const next = this.completions.shift();
    if (next === undefined) throw new LlmRequestError('FakeLlmClient: sem completions');
    return next;
  }

  async *stream(req: LlmRequest, signal?: AbortSignal): AsyncIterable<string> {
    this.requests.push(req);
    const chunks = this.options.chunks ?? [];
    for (let i = 0; i < chunks.length; i++) {
      if (this.options.failAfter !== undefined && i >= this.options.failAfter) {
        throw new LlmRequestError('FakeLlmClient: falha simulada');
      }
      if (this.options.delayMs) await new Promise((r) => setTimeout(r, this.options.delayMs));
      if (signal?.aborted) throw abortError();
      yield chunks[i] as string;
    }
  }
}
