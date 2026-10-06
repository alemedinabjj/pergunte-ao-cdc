import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from '../support/test-db';

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

describe('migrations', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await startTestDatabase();
  });
  afterAll(async () => {
    await t?.stop();
  });

  it('installs pgvector >= 0.8', async () => {
    const { rows } = await t.pool.query<{ extversion: string }>(
      "select extversion from pg_extension where extname = 'vector'",
    );
    expect(compareVersions(rows[0]?.extversion ?? '0', '0.8.0')).toBeGreaterThanOrEqual(0);
  });

  it('pt_unaccent matches unaccented queries and stems', async () => {
    const { rows } = await t.pool.query<{ hit: boolean }>(
      "select to_tsvector('pt_unaccent', 'proteção ao crédito') @@ plainto_tsquery('pt_unaccent', 'credito') as hit",
    );
    expect(rows[0]?.hit).toBe(true);
  });

  it('creates the hnsw and gin indexes', async () => {
    const { rows } = await t.pool.query<{ indexname: string }>(
      "select indexname from pg_indexes where tablename = 'chunks'",
    );
    expect(rows.map((r) => r.indexname)).toEqual(
      expect.arrayContaining(['chunks_embedding_hnsw', 'chunks_tsv_gin']),
    );
  });
});
