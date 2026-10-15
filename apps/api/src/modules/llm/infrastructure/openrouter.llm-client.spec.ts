import OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { toArray } from '../../../../test/support/streams';
import { LlmRequestError, LlmUnavailableError } from '../domain/errors';
import { OpenRouterLlmClient } from './openrouter.llm-client';

type Chunk = { choices: { delta?: { content?: string | null } }[]; error?: { message: string } };

async function* chunks(items: Chunk[]) {
  for (const item of items) yield item;
}

const req = {
  system: 'S',
  messages: [{ role: 'user' as const, content: 'Q' }],
  temperature: 0.2,
  maxTokens: 700,
};

function clientWith(create: (...args: unknown[]) => Promise<AsyncIterable<Chunk>>) {
  return new OpenRouterLlmClient(
    { chat: { completions: { create } } },
    { model: 'google/gemma-4-31b-it:free' },
  );
}

describe('OpenRouterLlmClient', () => {
  it('streams the content deltas and skips empty ones', async () => {
    const create = vi.fn(async () =>
      chunks([
        { choices: [{ delta: { content: 'Olá' } }] },
        { choices: [{ delta: {} }] },
        { choices: [] },
        { choices: [{ delta: { content: ' mundo' } }] },
      ]),
    );
    expect(await toArray(clientWith(create).stream(req))).toEqual(['Olá', ' mundo']);
  });

  it('sends the system prompt as the first chat message with sampling limits', async () => {
    const create = vi.fn(async () => chunks([]));
    const signal = new AbortController().signal;
    await toArray(clientWith(create).stream(req, signal));
    expect(create).toHaveBeenCalledWith(
      {
        model: 'google/gemma-4-31b-it:free',
        messages: [
          { role: 'system', content: 'S' },
          { role: 'user', content: 'Q' },
        ],
        temperature: 0.2,
        max_tokens: 700,
        stream: true,
      },
      { signal },
    );
  });

  it('complete joins the streamed text', async () => {
    const create = vi.fn(async () =>
      chunks([
        { choices: [{ delta: { content: 'a' } }] },
        { choices: [{ delta: { content: 'b' } }] },
      ]),
    );
    expect(await clientWith(create).complete(req)).toBe('ab');
  });

  it('fails when OpenRouter reports an error in the middle of the stream', async () => {
    const create = vi.fn(async () =>
      chunks([
        { choices: [{ delta: { content: 'Po' } }] },
        { choices: [], error: { message: 'provider crashed' } },
      ]),
    );
    await expect(toArray(clientWith(create).stream(req))).rejects.toBeInstanceOf(LlmRequestError);
  });

  it('explains the free-tier limit on 429', async () => {
    const create = vi.fn(async () => {
      throw new OpenAI.RateLimitError(429, undefined, 'rate limited', new Headers());
    });
    const error = await toArray(clientWith(create).stream(req)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmUnavailableError);
    expect((error as Error).message).toContain('limite');
  });
});
