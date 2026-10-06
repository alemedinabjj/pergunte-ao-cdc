import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamOf, toArray } from '../../../../test/support/streams';
import { LlmRequestError, LlmUnavailableError } from '../domain/errors';
import { OllamaLlmClient } from './ollama.llm-client';

const client = new OllamaLlmClient({ baseUrl: 'http://ollama.test', model: 'qwen2.5:3b' });
const req = { system: 'S', messages: [{ role: 'user' as const, content: 'Q' }] };

function ndjsonResponse(lines: object[]): Response {
  return new Response(streamOf(lines.map((l) => `${JSON.stringify(l)}\n`)));
}

afterEach(() => vi.unstubAllGlobals());

describe('OllamaLlmClient', () => {
  it('streams message.content pieces and stops at done', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ndjsonResponse([
          { message: { content: 'Olá' }, done: false },
          { message: { content: ' mundo' }, done: false },
          { message: { content: '' }, done: true },
        ]),
      ),
    );
    expect(await toArray(client.stream(req))).toEqual(['Olá', ' mundo']);
  });

  it('sends the system prompt as the first message and maps options', async () => {
    const fetchMock = vi.fn(async () => ndjsonResponse([{ message: { content: '' }, done: true }]));
    vi.stubGlobal('fetch', fetchMock);
    await toArray(client.stream({ ...req, temperature: 0.2, maxTokens: 700 }));
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    );
    expect(body.messages[0]).toEqual({ role: 'system', content: 'S' });
    expect(body.options).toEqual({ temperature: 0.2, num_predict: 700 });
    expect(body.stream).toBe(true);
  });

  it('complete returns the whole message content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ message: { content: 'resposta' }, done: true })),
    );
    expect(await client.complete(req)).toBe('resposta');
  });

  it('maps 5xx to LlmUnavailableError and 400 to LlmRequestError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    await expect(client.complete(req)).rejects.toBeInstanceOf(LlmUnavailableError);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'bad' }, { status: 400 })),
    );
    await expect(client.complete(req)).rejects.toBeInstanceOf(LlmRequestError);
  });
});
