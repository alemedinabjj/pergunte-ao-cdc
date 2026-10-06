import { describe, expect, it, vi } from 'vitest';
import { toArray } from '../../../../test/support/streams';
import { OpenAiLlmClient, type OpenAiResponsesApi } from './openai.llm-client';

async function* events(items: { type: string; delta?: string }[]) {
  for (const item of items) yield item;
}

const req = {
  system: 'S',
  messages: [{ role: 'user' as const, content: 'Q' }],
  temperature: 0.2,
  maxTokens: 700,
};

describe('OpenAiLlmClient', () => {
  it('streams output text deltas only', async () => {
    const create = vi.fn(async () =>
      events([
        { type: 'response.created' },
        { type: 'response.output_text.delta', delta: 'Olá' },
        { type: 'response.reasoning_summary_text.delta', delta: 'pensando' },
        { type: 'response.output_text.delta', delta: ' mundo' },
        { type: 'response.completed' },
      ]),
    );
    const client = new OpenAiLlmClient({ responses: { create } } satisfies OpenAiResponsesApi, {
      model: 'gpt-6-luna',
    });
    expect(await toArray(client.stream(req))).toEqual(['Olá', ' mundo']);
  });

  it('sends instructions and messages without sampling parameters', async () => {
    const create = vi.fn(async () => events([]));
    const signal = new AbortController().signal;
    const client = new OpenAiLlmClient({ responses: { create } }, { model: 'gpt-6-luna' });
    await toArray(client.stream(req, signal));
    expect(create).toHaveBeenCalledWith(
      {
        model: 'gpt-6-luna',
        instructions: 'S',
        input: [{ role: 'user', content: 'Q' }],
        reasoning: { effort: 'low' },
        stream: true,
      },
      { signal },
    );
  });

  it('complete joins the streamed text', async () => {
    const create = vi.fn(async () =>
      events([
        { type: 'response.output_text.delta', delta: 'a' },
        { type: 'response.output_text.delta', delta: 'b' },
      ]),
    );
    const client = new OpenAiLlmClient({ responses: { create } }, { model: 'gpt-6-luna' });
    expect(await client.complete(req)).toBe('ab');
  });

  it('turns a failed response event into LlmRequestError', async () => {
    const create = vi.fn(async () => events([{ type: 'response.failed' }]));
    const client = new OpenAiLlmClient({ responses: { create } }, { model: 'gpt-6-luna' });
    await expect(toArray(client.stream(req))).rejects.toThrow(/falhou/);
  });
});
