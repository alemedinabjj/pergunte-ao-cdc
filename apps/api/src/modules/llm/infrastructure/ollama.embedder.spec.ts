import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlmUnavailableError } from '../domain/errors';
import { OllamaEmbedder } from './ollama.embedder';

const embedder = new OllamaEmbedder({
  baseUrl: 'http://ollama.test',
  model: 'bge-m3',
  dimensions: 3,
});

afterEach(() => vi.unstubAllGlobals());

describe('OllamaEmbedder', () => {
  it('returns embeddings for a batch', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        embeddings: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    expect(await embedder.embed(['a', 'b'])).toHaveLength(2);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://ollama.test/api/embed');
    expect(JSON.parse(String(init.body))).toEqual({ model: 'bge-m3', input: ['a', 'b'] });
  });

  it('maps connection refused to LlmUnavailableError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    await expect(embedder.embed(['a'])).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it('tells the user to pull the model when Ollama returns 404 model not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'model "bge-m3" not found' }, { status: 404 })),
    );
    await expect(embedder.embed(['a'])).rejects.toThrow('ollama pull bge-m3');
  });

  it('rejects a response that does not match the expected shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ nope: true })),
    );
    await expect(embedder.embed(['a'])).rejects.toThrow();
  });
});
