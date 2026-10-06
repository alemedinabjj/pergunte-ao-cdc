import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ChunksRepository } from '../../src/modules/ingestion/chunks.repository';
import {
  EmbeddingDimensionMismatchError,
  formatReport,
  IngestLawUseCase,
} from '../../src/modules/ingestion/ingest-law.use-case';
import { FakeEmbedder } from '../fakes/fake-embedder';
import { startTestDatabase, type TestDatabase } from '../support/test-db';

const FIXTURE = `CAPÍTULO I
Disposições Gerais
Art. 1º O presente código estabelece normas de proteção do consumidor.
Art. 2º Consumidor é toda pessoa física ou jurídica que adquire produto.
Art. 3º Fornecedor é toda pessoa que desenvolve atividade de crédito.`;

const FIXTURE_CHANGED_ONE_REMOVED_ONE = `CAPÍTULO I
Disposições Gerais
Art. 1º O presente código estabelece normas de proteção do consumidor.
Art. 2º Consumidor é toda pessoa física ou jurídica que adquire ou utiliza produto.`;

describe('IngestLawUseCase', () => {
  let t: TestDatabase;
  let embedder: FakeEmbedder;
  let useCase: IngestLawUseCase;

  const countChunks = async () =>
    Number((await t.pool.query<{ n: string }>('select count(*) as n from chunks')).rows[0]?.n);

  beforeAll(async () => {
    t = await startTestDatabase();
  });
  afterAll(async () => {
    await t?.stop();
  });
  beforeEach(async () => {
    await t.db.execute(sql`TRUNCATE chunks, laws RESTART IDENTITY CASCADE`);
    embedder = new FakeEmbedder();
    useCase = new IngestLawUseCase(new ChunksRepository(t.db), embedder, {
      dimensions: 1024,
      lawsDir: '/nonexistent',
    });
  });

  it('inserts all chunks on first run', async () => {
    const r = await useCase.execute('cdc', { text: FIXTURE });
    expect(r).toMatchObject({
      slug: 'cdc',
      total: 3,
      created: 3,
      updated: 0,
      unchanged: 0,
      deleted: 0,
    });
    expect(await countChunks()).toBe(3);
  });

  it('is idempotent: second run embeds nothing', async () => {
    await useCase.execute('cdc', { text: FIXTURE });
    embedder.calls.length = 0;
    const r = await useCase.execute('cdc', { text: FIXTURE });
    expect(r).toMatchObject({ created: 0, updated: 0, unchanged: 3 });
    expect(embedder.calls.flat().filter((text) => text !== 'dimension probe')).toHaveLength(0);
  });

  it('re-embeds only changed articles and deletes removed ones', async () => {
    await useCase.execute('cdc', { text: FIXTURE });
    const r = await useCase.execute('cdc', { text: FIXTURE_CHANGED_ONE_REMOVED_ONE });
    expect(r).toMatchObject({ total: 2, created: 0, updated: 1, unchanged: 1, deleted: 1 });
    expect(await countChunks()).toBe(2);
  });

  it('re-embeds everything with force', async () => {
    await useCase.execute('cdc', { text: FIXTURE });
    expect((await useCase.execute('cdc', { text: FIXTURE, force: true })).updated).toBe(3);
  });

  it('fails before writing when embedding dimensions do not match', async () => {
    const bad = new IngestLawUseCase(new ChunksRepository(t.db), new FakeEmbedder(768), {
      dimensions: 1024,
      lawsDir: '/nonexistent',
    });
    await expect(bad.execute('cdc', { text: FIXTURE })).rejects.toBeInstanceOf(
      EmbeddingDimensionMismatchError,
    );
    expect(await countChunks()).toBe(0);
  });

  it('stores a tsvector that matches unaccented terms', async () => {
    await useCase.execute('cdc', { text: FIXTURE });
    const { rows } = await t.pool.query<{ n: string }>(
      "select count(*) as n from chunks where tsv @@ plainto_tsquery('pt_unaccent', 'credito')",
    );
    expect(Number(rows[0]?.n)).toBe(1);
  });

  it('stores law metadata from the catalog', async () => {
    await useCase.execute('cdc', { text: FIXTURE });
    const { rows } = await t.pool.query('select slug, short_name from laws');
    expect(rows).toEqual([{ slug: 'cdc', short_name: 'CDC' }]);
  });

  it('formats a report line', () => {
    expect(
      formatReport({
        slug: 'cdc',
        total: 132,
        created: 4,
        updated: 0,
        unchanged: 128,
        deleted: 0,
        durationMs: 3210,
      }),
    ).toBe('cdc: 132 chunks (4 novos, 0 alterados, 128 sem mudança, 0 removidos) em 3.2s');
  });
});
