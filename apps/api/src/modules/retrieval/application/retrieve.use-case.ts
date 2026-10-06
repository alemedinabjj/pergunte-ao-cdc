import type { LawSlug } from '@cdc/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { EMBEDDER, type Embedder } from '../../llm/domain/embedder.port';
import type { RetrievalMode, RetrievalResult } from '../domain/retrieval.types';
import { HybridRetriever } from '../infrastructure/hybrid.retriever';

export interface RetrieveInput {
  text: string;
  lawSlug?: LawSlug;
  mode?: RetrievalMode;
  limit?: number;
}

const DEFAULT_LIMIT = 6;
const CANDIDATES = 30;

@Injectable()
export class RetrieveUseCase {
  constructor(
    private readonly retriever: HybridRetriever,
    @Inject(EMBEDDER) private readonly embedder: Embedder,
  ) {}

  async execute(input: RetrieveInput, signal?: AbortSignal): Promise<RetrievalResult> {
    const mode = input.mode ?? 'hybrid';
    const embedding =
      mode === 'keyword' ? null : ((await this.embedder.embed([input.text], signal))[0] ?? null);
    return this.retriever.search({
      text: input.text,
      embedding,
      lawSlug: input.lawSlug,
      mode,
      limit: input.limit ?? DEFAULT_LIMIT,
      candidates: CANDIDATES,
    });
  }
}
