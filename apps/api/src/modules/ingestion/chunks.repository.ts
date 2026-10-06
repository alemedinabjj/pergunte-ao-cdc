import { Inject, Injectable } from '@nestjs/common';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import { DB, type Db } from '../../database/database.module';
import { chunks, laws } from '../../database/schema';
import type { ChunkDraft } from './chunker';
import type { LawMeta } from './laws.catalog';

export interface ChunkState {
  contentHash: string;
  embeddingModel: string;
  position: number;
}

export interface EmbeddedChunk extends ChunkDraft {
  embedding: number[];
  embeddingModel: string;
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

@Injectable()
export class ChunksRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findStateByLaw(slug: string): Promise<Map<string, ChunkState>> {
    const rows = await this.db
      .select({
        path: chunks.path,
        contentHash: chunks.contentHash,
        embeddingModel: chunks.embeddingModel,
        position: chunks.position,
      })
      .from(chunks)
      .innerJoin(laws, eq(laws.id, chunks.lawId))
      .where(eq(laws.slug, slug));
    return new Map(rows.map(({ path, ...state }) => [path, state]));
  }

  /** Grava tudo de uma lei numa transação: metadados, chunks novos/alterados, posições e remoções. */
  async saveLaw(
    meta: LawMeta,
    changed: EmbeddedChunk[],
    unchangedPositions: { path: string; position: number }[],
    keepPaths: string[],
  ): Promise<number> {
    return this.db.transaction(async (tx) => {
      const lawId = await this.upsertLaw(tx, meta);
      if (changed.length > 0) await this.upsertChunks(tx, lawId, changed);
      for (const { path, position } of unchangedPositions) {
        await tx
          .update(chunks)
          .set({ position })
          .where(and(eq(chunks.lawId, lawId), eq(chunks.path, path)));
      }
      const deleted = await tx
        .delete(chunks)
        .where(
          keepPaths.length > 0
            ? and(eq(chunks.lawId, lawId), notInArray(chunks.path, keepPaths))
            : eq(chunks.lawId, lawId),
        )
        .returning({ id: chunks.id });
      return deleted.length;
    });
  }

  private async upsertLaw(tx: Tx, meta: LawMeta): Promise<number> {
    const values = {
      slug: meta.slug,
      title: meta.title,
      shortName: meta.shortName,
      reference: meta.reference,
      sourceUrl: meta.sourceUrl,
    };
    const [row] = await tx
      .insert(laws)
      .values(values)
      .onConflictDoUpdate({ target: laws.slug, set: values })
      .returning({ id: laws.id });
    if (!row) throw new Error(`Falha ao gravar a lei ${meta.slug}`);
    return row.id;
  }

  private async upsertChunks(tx: Tx, lawId: number, rows: EmbeddedChunk[]): Promise<void> {
    await tx
      .insert(chunks)
      .values(
        rows.map((row) => ({
          lawId,
          path: row.path,
          article: row.article,
          breadcrumb: row.breadcrumb,
          content: row.content,
          embeddedText: row.embeddedText,
          tsv: sql`to_tsvector('pt_unaccent', ${row.embeddedText})`,
          embedding: row.embedding,
          embeddingModel: row.embeddingModel,
          contentHash: row.contentHash,
          position: row.position,
        })),
      )
      .onConflictDoUpdate({
        target: [chunks.lawId, chunks.path],
        set: {
          article: sql`excluded.article`,
          breadcrumb: sql`excluded.breadcrumb`,
          content: sql`excluded.content`,
          embeddedText: sql`excluded.embedded_text`,
          tsv: sql`excluded.tsv`,
          embedding: sql`excluded.embedding`,
          embeddingModel: sql`excluded.embedding_model`,
          contentHash: sql`excluded.content_hash`,
          position: sql`excluded.position`,
        },
      });
  }
}
