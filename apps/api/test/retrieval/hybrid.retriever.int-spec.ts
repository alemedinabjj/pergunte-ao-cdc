import type { LawSlug } from '@cdc/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ChunksRepository } from '../../src/modules/ingestion/chunks.repository';
import { IngestLawUseCase } from '../../src/modules/ingestion/ingest-law.use-case';
import { RetrieveUseCase } from '../../src/modules/retrieval/application/retrieve.use-case';
import type { RetrievalMode } from '../../src/modules/retrieval/domain/retrieval.types';
import { HybridRetriever } from '../../src/modules/retrieval/infrastructure/hybrid.retriever';
import { FakeEmbedder } from '../fakes/fake-embedder';
import { startTestDatabase, type TestDatabase } from '../support/test-db';

const CDC = `TÍTULO I
Dos Direitos do Consumidor
Art. 2º Consumidor é toda pessoa física ou jurídica que adquire ou utiliza produto ou serviço como destinatário final.
Art. 6º São direitos básicos do consumidor:
I - a proteção da vida, saúde e segurança;
II - a informação adequada e clara sobre os diferentes produtos e serviços;
Art. 18. Os fornecedores de produtos de consumo duráveis ou não duráveis respondem solidariamente pelos vícios de qualidade.
§ 1º Não sendo o vício sanado no prazo máximo de trinta dias, pode o consumidor exigir a substituição do produto.
Art. 39. É vedado ao fornecedor de produtos ou serviços, dentre outras práticas abusivas:
I - condicionar o fornecimento de produto ou de serviço ao fornecimento de outro produto ou serviço;
Art. 43. O consumidor terá acesso às informações existentes em cadastros, fichas, registros e dados pessoais.
§ 4º Os bancos de dados e cadastros relativos a consumidores, os serviços de proteção ao crédito e congêneres são considerados entidades de caráter público.
Art. 49. O consumidor pode desistir do contrato, no prazo de 7 dias a contar de sua assinatura ou do ato de recebimento do produto ou serviço, sempre que a contratação ocorrer fora do estabelecimento comercial.
Art. 54-A. Este Capítulo dispõe sobre a prevenção do superendividamento da pessoa natural.`;

const DECRETO = `Art. 2º Os sítios eletrônicos utilizados para oferta ou conclusão de contrato de consumo devem disponibilizar o nome empresarial e o número de inscrição do fornecedor.
Art. 4º Para garantir o atendimento facilitado ao consumidor no comércio eletrônico, o fornecedor deverá confirmar imediatamente o recebimento da aceitação da oferta.`;

describe('HybridRetriever', () => {
  let t: TestDatabase;
  let useCase: RetrieveUseCase;

  const retrieve = (
    text: string,
    opts: { mode?: RetrievalMode; lawSlug?: LawSlug; limit?: number } = {},
  ) => useCase.execute({ text, ...opts });

  beforeAll(async () => {
    t = await startTestDatabase();
    const embedder = new FakeEmbedder();
    const ingest = new IngestLawUseCase(new ChunksRepository(t.db), embedder, {
      dimensions: 1024,
      lawsDir: '/nonexistent',
    });
    await ingest.execute('cdc', { text: CDC });
    await ingest.execute('decreto-7962', { text: DECRETO });
    useCase = new RetrieveUseCase(new HybridRetriever(t.db), embedder);
  });
  afterAll(async () => {
    await t?.stop();
  });

  it('ranks an exactly referenced article first', async () => {
    const r = await retrieve('o que diz o art. 49?', { lawSlug: 'cdc' });
    expect(r.chunks[0]?.article).toBe('49');
  });

  it('finds terms without accents through keyword search', async () => {
    const r = await retrieve('protecao ao credito', { mode: 'keyword' });
    expect(r.chunks.map((c) => c.article)).toContain('43');
    expect(r.chunks.every((c) => c.similarity === null)).toBe(true);
  });

  it('matches natural-language questions in keyword mode (OR semantics)', async () => {
    const r = await retrieve('posso desistir da compra feita fora do estabelecimento?', {
      mode: 'keyword',
    });
    expect(r.chunks[0]?.article).toBe('49');
  });

  it('finds related text in semantic mode', async () => {
    const r = await retrieve('superendividamento da pessoa', { mode: 'semantic' });
    expect(r.chunks[0]?.article).toBe('54-A');
    expect(r.chunks[0]?.similarity).toBeGreaterThan(0);
  });

  it('filters by law in every list', async () => {
    const r = await retrieve('art. 2', { lawSlug: 'decreto-7962' });
    expect(r.chunks.length).toBeGreaterThan(0);
    expect(r.chunks.every((c) => c.lawSlug === 'decreto-7962')).toBe(true);
  });

  it('reports topSimilarity and exactMatch', async () => {
    const r = await retrieve('o que diz o art. 49?');
    expect(r.exactMatch).toBe(true);
    expect(r.topSimilarity).toBeGreaterThan(0);
    const noRef = await retrieve('direitos básicos do consumidor');
    expect(noRef.exactMatch).toBe(false);
  });

  it('returns at most limit chunks with descending scores and law metadata', async () => {
    const r = await retrieve('consumidor produto serviço', { limit: 3 });
    expect(r.chunks).toHaveLength(3);
    const scores = r.chunks.map((c) => c.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(r.chunks[0]).toMatchObject({
      lawShortName: expect.any(String),
      sourceUrl: expect.stringMatching(/^https:/),
    });
  });

  it('returns an empty result when nothing matches', async () => {
    const r = await retrieve('xyzw qwerty', { mode: 'keyword' });
    expect(r).toEqual({ chunks: [], topSimilarity: null, exactMatch: false });
  });
});
