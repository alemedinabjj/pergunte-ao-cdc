import { lawSlugSchema } from '@cdc/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { DB, type Db } from '../../../database/database.module';
import { extractArticleRef } from '../domain/article-ref';
import type { RetrievalResult, SearchQuery } from '../domain/retrieval.types';

const RRF_K = 60;

const rowSchema = z.object({
  id: z.uuid(),
  slug: lawSlugSchema,
  short_name: z.string(),
  path: z.string(),
  article: z.string(),
  content: z.string(),
  source_url: z.string(),
  score: z.coerce.number(),
  similarity: z.coerce.number().nullable(),
  top_similarity: z.coerce.number().nullable(),
  exact_match: z.boolean(),
});

/**
 * Busca híbrida numa query só: vizinhos por cosseno (pgvector) + full-text em português
 * (termos ligados por OR) + match exato de artigo, fundidos por Reciprocal Rank Fusion.
 */
@Injectable()
export class HybridRetriever {
  constructor(@Inject(DB) private readonly db: Db) {}

  async search(q: SearchQuery): Promise<RetrievalResult> {
    const embedding = q.embedding ? sql`${JSON.stringify(q.embedding)}::vector` : sql`NULL::vector`;
    const law = q.lawSlug ?? null;
    const article = extractArticleRef(q.text);

    const query = sql`
      WITH semantic AS (
        SELECT id, similarity, row_number() OVER (ORDER BY distance) AS rank FROM (
          SELECT c.id, c.embedding <=> ${embedding} AS distance,
                 1 - (c.embedding <=> ${embedding}) AS similarity
          FROM chunks c JOIN laws l ON l.id = c.law_id
          WHERE ${q.mode}::text <> 'keyword' AND (${law}::text IS NULL OR l.slug = ${law}::text)
          ORDER BY distance
          LIMIT ${q.candidates}::int
        ) s
      ),
      tsq AS (
        SELECT NULLIF(replace(plainto_tsquery('pt_unaccent', ${q.text})::text, '&', '|'), '')::tsquery AS q
      ),
      keyword AS (
        SELECT id, row_number() OVER (ORDER BY r DESC) AS rank FROM (
          SELECT c.id, ts_rank_cd(c.tsv, tsq.q) AS r
          FROM chunks c JOIN laws l ON l.id = c.law_id, tsq
          WHERE ${q.mode}::text <> 'semantic' AND tsq.q IS NOT NULL AND c.tsv @@ tsq.q
            AND (${law}::text IS NULL OR l.slug = ${law}::text)
          ORDER BY r DESC
          LIMIT ${q.candidates}::int
        ) k
      ),
      exact AS (
        SELECT c.id, row_number() OVER (ORDER BY c.position) AS rank
        FROM chunks c JOIN laws l ON l.id = c.law_id
        WHERE ${q.mode}::text = 'hybrid' AND ${article}::text IS NOT NULL AND c.article = ${article}::text
          AND (${law}::text IS NULL OR l.slug = ${law}::text)
      ),
      fused AS (
        SELECT id, sum(1.0 / (${RRF_K} + rank)) AS score
        FROM (
          SELECT id, rank FROM semantic
          UNION ALL SELECT id, rank FROM keyword
          UNION ALL SELECT id, rank FROM exact
        ) u
        GROUP BY id
      )
      SELECT c.id, l.slug, l.short_name, c.path, c.article, c.content, l.source_url,
             f.score, s.similarity,
             (SELECT max(similarity) FROM semantic) AS top_similarity,
             EXISTS (SELECT 1 FROM exact) AS exact_match
      FROM fused f
      JOIN chunks c ON c.id = f.id
      JOIN laws l ON l.id = c.law_id
      LEFT JOIN semantic s ON s.id = f.id
      ORDER BY f.score DESC, c.position
      LIMIT ${q.limit}::int
    `;

    const result = await this.db.transaction(async (tx) => {
      // pgvector >= 0.8: continua varrendo o HNSW até achar k linhas que passem no filtro.
      await tx.execute(sql`SET LOCAL hnsw.iterative_scan = relaxed_order`);
      return tx.execute(query);
    });

    const rows = z.array(rowSchema).parse(result.rows);
    const first = rows[0];
    return {
      chunks: rows.map((row) => ({
        id: row.id,
        lawSlug: row.slug,
        lawShortName: row.short_name,
        path: row.path,
        article: row.article,
        content: row.content,
        sourceUrl: row.source_url,
        score: row.score,
        similarity: row.similarity,
      })),
      topSimilarity: first?.top_similarity ?? null,
      exactMatch: first?.exact_match ?? false,
    };
  }
}
