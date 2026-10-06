import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import { ChunksRepository } from '../../src/modules/ingestion/chunks.repository';
import { IngestLawUseCase } from '../../src/modules/ingestion/ingest-law.use-case';
import { EMBEDDER } from '../../src/modules/llm/domain/embedder.port';
import { LLM_CLIENT } from '../../src/modules/llm/domain/llm-client.port';
import { LLM_HEALTH } from '../../src/modules/llm/domain/llm-health.port';
import { FakeEmbedder } from '../fakes/fake-embedder';
import { FakeLlmClient } from '../fakes/fake-llm-client';
import { parseSseBody } from '../support/sse';
import { startTestDatabase, type TestDatabase } from '../support/test-db';

const FIXTURE = `Art. 49. O consumidor pode desistir do contrato, no prazo de 7 dias, sempre que a contratação ocorrer fora do estabelecimento comercial.
Art. 18. Os fornecedores respondem solidariamente pelos vícios de qualidade dos produtos.`;

const textParser = (res: request.Response, cb: (err: Error | null, body: string) => void) => {
  let data = '';
  res.on('data', (chunk: Buffer) => {
    data += chunk.toString();
  });
  res.on('end', () => cb(null, data));
};

describe('HTTP API', () => {
  let t: TestDatabase;
  let app: INestApplication;
  const health = {
    up: true,
    unavailableMessage: 'Confira a OPENAI_API_KEY.',
    ping: async () => health.up,
  };
  const llm = { current: new FakeLlmClient({ chunks: ['Pode ', 'sim [1].'] }) };
  const llmProxy = {
    get model() {
      return llm.current.model;
    },
    complete: (...args: Parameters<FakeLlmClient['complete']>) => llm.current.complete(...args),
    stream: (...args: Parameters<FakeLlmClient['stream']>) => llm.current.stream(...args),
  };

  const lastAssistantStatus = async () =>
    (
      await t.pool.query<{ status: string }>(
        "select status from messages where role = 'assistant' order by created_at desc limit 1",
      )
    ).rows[0]?.status;

  beforeAll(async () => {
    t = await startTestDatabase();
    process.env.DATABASE_URL = t.url;
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'sk-test-fake';
    process.env.LOG_LEVEL = 'error';
    const embedder = new FakeEmbedder();
    await new IngestLawUseCase(new ChunksRepository(t.db), embedder, {
      dimensions: 1024,
      lawsDir: '/nonexistent',
    }).execute('cdc', { text: FIXTURE });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMBEDDER)
      .useValue(embedder)
      .overrideProvider(LLM_CLIENT)
      .useValue(llmProxy)
      .overrideProvider(LLM_HEALTH)
      .useValue(health)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await t?.stop();
  });

  beforeEach(() => {
    health.up = true;
    llm.current = new FakeLlmClient({ chunks: ['Pode ', 'sim [1].'] });
  });

  it('streams events for a new conversation', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/chat')
      .send({ question: 'o que diz o art. 49?' })
      .buffer(true)
      .parse(textParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    expect(res.headers['x-accel-buffering']).toBe('no');
    const events = parseSseBody(res.body as string);
    expect(events.map((e) => e.type)).toEqual(['meta', 'citations', 'token', 'token', 'done']);
  });

  it('400 on a too short question', async () => {
    const res = await request(app.getHttpServer()).post('/api/chat').send({ question: 'oi' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('404 for an unknown conversation, before streaming', async () => {
    const res = await request(app.getHttpServer()).post('/api/chat').send({
      question: 'posso devolver?',
      conversationId: '00000000-0000-4000-8000-000000000000',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CONVERSATION_NOT_FOUND');
  });

  it('503 with the provider message when the LLM provider is down', async () => {
    health.up = false;
    const res = await request(app.getHttpServer())
      .post('/api/chat')
      .send({ question: 'posso devolver?' });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('LLM_UNAVAILABLE');
    expect(res.body.message).toBe('Confira a OPENAI_API_KEY.');
  });

  it('aborts generation when the client disconnects', async () => {
    llm.current = new FakeLlmClient({
      chunks: Array.from({ length: 20 }, () => 'x '),
      delayMs: 50,
    });
    const server = app.getHttpServer();
    if (!server.listening) await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    await new Promise<void>((resolve, reject) => {
      const req = httpRequest(
        {
          port,
          path: '/api/chat',
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        },
        (res) => {
          res.on('data', (chunk: Buffer) => {
            if (chunk.toString().includes('event: token')) {
              req.destroy();
              resolve();
            }
          });
        },
      );
      req.on('error', () => undefined);
      req.end(JSON.stringify({ question: 'o que diz o art. 49?' }));
      setTimeout(() => reject(new Error('no token received')), 5_000);
    });

    await vi.waitFor(async () => expect(await lastAssistantStatus()).toBe('incomplete'), {
      timeout: 5_000,
    });
  });

  it('lists, gets and deletes conversations', async () => {
    const chat = await request(app.getHttpServer())
      .post('/api/chat')
      .send({ question: 'o que diz o art. 18?' })
      .buffer(true)
      .parse(textParser);
    const meta = parseSseBody(chat.body as string)[0];
    if (meta?.type !== 'meta') throw new Error('missing meta');

    const list = await request(app.getHttpServer()).get('/api/conversations');
    expect(list.status).toBe(200);
    expect(list.body[0]).toMatchObject({ id: meta.conversationId, title: 'o que diz o art. 18?' });

    const detail = await request(app.getHttpServer()).get(
      `/api/conversations/${meta.conversationId}`,
    );
    expect(detail.body.messages.map((m: { role: string }) => m.role)).toEqual([
      'user',
      'assistant',
    ]);

    expect(
      (await request(app.getHttpServer()).delete(`/api/conversations/${meta.conversationId}`))
        .status,
    ).toBe(204);
    expect(
      (await request(app.getHttpServer()).get(`/api/conversations/${meta.conversationId}`)).status,
    ).toBe(404);
    expect(
      (await request(app.getHttpServer()).delete(`/api/conversations/${meta.conversationId}`))
        .status,
    ).toBe(404);
  });

  it('400 for a malformed conversation id', async () => {
    expect((await request(app.getHttpServer()).get('/api/conversations/nope')).status).toBe(400);
  });

  it('lists laws', async () => {
    const res = await request(app.getHttpServer()).get('/api/laws');
    expect(res.body).toEqual([expect.objectContaining({ slug: 'cdc', shortName: 'CDC' })]);
  });

  it('health returns 503 and llm: down when ping fails', async () => {
    expect((await request(app.getHttpServer()).get('/api/health')).body).toEqual({
      db: 'ok',
      llm: 'ok',
    });
    health.up = false;
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ db: 'ok', llm: 'down' });
  });
});
