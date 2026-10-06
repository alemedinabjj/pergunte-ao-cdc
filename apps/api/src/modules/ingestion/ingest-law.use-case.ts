import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { LawSlug } from '@cdc/contracts';
import type { Embedder } from '../llm/domain/embedder.port';
import { withRetry } from '../llm/retry';
import { chunkLaw } from './chunker';
import type { ChunksRepository, EmbeddedChunk } from './chunks.repository';
import { findLaw } from './laws.catalog';
import { normalizeLawText } from './normalize';
import { parseLaw } from './parser';

export interface IngestReport {
  slug: LawSlug;
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
  durationMs: number;
}

export interface IngestConfig {
  dimensions: number;
  lawsDir: string;
}

export class EmbeddingDimensionMismatchError extends Error {
  override readonly name = 'EmbeddingDimensionMismatchError';
}

const BATCH_SIZE = 32;

export class IngestLawUseCase {
  constructor(
    private readonly repository: ChunksRepository,
    private readonly embedder: Embedder,
    private readonly config: IngestConfig,
  ) {}

  async execute(
    slug: LawSlug,
    opts: { force?: boolean; text?: string } = {},
  ): Promise<IngestReport> {
    const startedAt = Date.now();
    const law = findLaw(slug);
    await this.assertDimensions();

    const raw = opts.text ?? (await readFile(resolve(this.config.lawsDir, law.file), 'utf8'));
    const drafts = chunkLaw(law, parseLaw(normalizeLawText(raw)));
    const existing = await this.repository.findStateByLaw(slug);

    const toEmbed = drafts.filter((draft) => {
      const state = existing.get(draft.path);
      return (
        opts.force ||
        !state ||
        state.contentHash !== draft.contentHash ||
        state.embeddingModel !== this.embedder.model
      );
    });
    const toEmbedPaths = new Set(toEmbed.map((draft) => draft.path));
    const unchanged = drafts.filter((draft) => !toEmbedPaths.has(draft.path));

    // Rede fora da transação: embeddings primeiro, gravação depois.
    const embedded: EmbeddedChunk[] = [];
    for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
      const batch = toEmbed.slice(i, i + BATCH_SIZE);
      const vectors = await withRetry(() => this.embedder.embed(batch.map((d) => d.embeddedText)));
      batch.forEach((draft, index) => {
        const embedding = vectors[index];
        if (!embedding) throw new Error(`Embedding ausente para ${draft.path}`);
        embedded.push({ ...draft, embedding, embeddingModel: this.embedder.model });
      });
    }

    const deleted = await this.repository.saveLaw(
      law,
      embedded,
      unchanged
        .filter((draft) => existing.get(draft.path)?.position !== draft.position)
        .map(({ path, position }) => ({ path, position })),
      drafts.map((draft) => draft.path),
    );

    const created = toEmbed.filter((draft) => !existing.has(draft.path)).length;
    return {
      slug,
      total: drafts.length,
      created,
      updated: toEmbed.length - created,
      unchanged: unchanged.length,
      deleted,
      durationMs: Date.now() - startedAt,
    };
  }

  private async assertDimensions(): Promise<void> {
    const [probe] = await withRetry(() => this.embedder.embed(['dimension probe']));
    const actual = probe?.length ?? 0;
    if (actual !== this.config.dimensions) {
      throw new EmbeddingDimensionMismatchError(
        `O modelo "${this.embedder.model}" gera vetores de ${actual} dimensões, mas a coluna ` +
          `chunks.embedding tem ${this.config.dimensions}. Ajuste EMBEDDING_DIMENSIONS e a migration, ` +
          'ou use um modelo com a dimensão certa.',
      );
    }
  }
}

export function formatReport(r: IngestReport): string {
  const seconds = (r.durationMs / 1000).toFixed(1);
  return (
    `${r.slug}: ${r.total} chunks (${r.created} novos, ${r.updated} alterados, ` +
    `${r.unchanged} sem mudança, ${r.deleted} removidos) em ${seconds}s`
  );
}
