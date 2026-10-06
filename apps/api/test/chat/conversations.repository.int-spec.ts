import type { Citation } from '@cdc/contracts';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConversationsRepository } from '../../src/modules/chat/infrastructure/conversations.repository';
import { startTestDatabase, type TestDatabase } from '../support/test-db';

const citation: Citation = {
  id: 2,
  chunkId: '0b0f2d3e-8a51-4e5e-9a3c-1f2d3e4a5b6c',
  lawSlug: 'cdc',
  law: 'CDC',
  path: 'Art. 49',
  content: 'Art. 49. O consumidor pode desistir.',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
};

describe('ConversationsRepository', () => {
  let t: TestDatabase;
  let repo: ConversationsRepository;

  beforeAll(async () => {
    t = await startTestDatabase();
    repo = new ConversationsRepository(t.db);
  });
  afterAll(async () => {
    await t?.stop();
  });
  beforeEach(async () => {
    await t.db.execute(sql`TRUNCATE conversations CASCADE`);
  });

  it('round-trips a conversation with messages and citations, newest conversation first', async () => {
    const first = await repo.create('Primeira');
    const second = await repo.create('Segunda');
    await repo.addUserMessage(first, 'Posso devolver?', null);
    await repo.addAssistantMessage({
      id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      conversationId: first,
      content: 'Pode [2].',
      status: 'complete',
      citations: [citation],
      model: 'qwen2.5:3b',
      latencyMs: 1200,
    });

    expect((await repo.list()).map((c) => c.id)).toEqual([second, first]);
    const detail = await repo.get(first);
    expect(detail?.title).toBe('Primeira');
    expect(detail?.messages.map((m) => [m.role, m.content, m.status])).toEqual([
      ['user', 'Posso devolver?', 'complete'],
      ['assistant', 'Pode [2].', 'complete'],
    ]);
    expect(detail?.messages[1]?.citations).toEqual([citation]);
    expect(detail?.messages[0]?.citations).toBeNull();
    expect(await repo.exists(first)).toBe(true);
  });

  it('history returns only complete messages, chronological, limited', async () => {
    const id = await repo.create('c');
    for (const content of ['q1', 'q2', 'q3']) await repo.addUserMessage(id, content, null);
    await repo.addAssistantMessage({
      id: 'b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      conversationId: id,
      content: 'parcial',
      status: 'incomplete',
      citations: [],
      model: null,
      latencyMs: 10,
    });
    expect(await repo.history(id, 2)).toEqual([
      { role: 'user', content: 'q2' },
      { role: 'user', content: 'q3' },
    ]);
  });

  it('delete cascades messages and reports missing ids', async () => {
    const id = await repo.create('c');
    await repo.addUserMessage(id, 'q', null);
    expect(await repo.delete(id)).toBe(true);
    expect(await repo.get(id)).toBeNull();
    expect(await repo.delete(id)).toBe(false);
    const { rows } = await t.pool.query('select count(*)::int as n from messages');
    expect(rows[0]).toEqual({ n: 0 });
  });
});
