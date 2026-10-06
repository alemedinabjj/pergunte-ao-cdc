import { describe, expect, it } from 'vitest';
import { cosine } from '../support/streams';
import { FakeEmbedder } from './fake-embedder';

describe('FakeEmbedder', () => {
  it('is deterministic and closer for overlapping words', async () => {
    const embedder = new FakeEmbedder();
    const [a, b, c] = await embedder.embed([
      'prazo de arrependimento',
      'arrependimento prazo',
      'cadastro negativo',
    ]);
    if (!a || !b || !c) throw new Error('missing vectors');
    expect(a).toHaveLength(1024);
    expect(cosine(a, b)).toBeGreaterThan(cosine(a, c));
    expect(await embedder.embed(['prazo de arrependimento'])).toEqual([a]);
  });

  it('records calls', async () => {
    const embedder = new FakeEmbedder();
    await embedder.embed(['x']);
    expect(embedder.calls).toEqual([['x']]);
  });
});
