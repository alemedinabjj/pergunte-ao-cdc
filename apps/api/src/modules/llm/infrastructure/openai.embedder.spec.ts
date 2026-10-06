import OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { LlmUnavailableError } from '../domain/errors';
import { OpenAiEmbedder, type OpenAiEmbeddingsApi } from './openai.embedder';

function fakeClient(create: OpenAiEmbeddingsApi['embeddings']['create']): OpenAiEmbeddingsApi {
  return { embeddings: { create } };
}

describe('OpenAiEmbedder', () => {
  it('requests shortened float embeddings and returns them in input order', async () => {
    const create = vi.fn(async () => ({
      data: [
        { index: 1, embedding: [0.4, 0.5] },
        { index: 0, embedding: [0.1, 0.2] },
      ],
    }));
    const embedder = new OpenAiEmbedder(fakeClient(create), {
      model: 'text-embedding-3-small',
      dimensions: 2,
    });
    expect(await embedder.embed(['a', 'b'])).toEqual([
      [0.1, 0.2],
      [0.4, 0.5],
    ]);
    expect(create).toHaveBeenCalledWith(
      {
        model: 'text-embedding-3-small',
        input: ['a', 'b'],
        dimensions: 2,
        encoding_format: 'float',
      },
      { signal: undefined },
    );
    expect(embedder.model).toBe('text-embedding-3-small');
  });

  it('maps SDK errors to domain errors', async () => {
    const embedder = new OpenAiEmbedder(
      fakeClient(async () => {
        throw new OpenAI.APIConnectionError({ message: 'offline' });
      }),
      { model: 'text-embedding-3-small', dimensions: 2 },
    );
    await expect(embedder.embed(['a'])).rejects.toBeInstanceOf(LlmUnavailableError);
  });
});
