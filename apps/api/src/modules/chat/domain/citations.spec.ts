import { describe, expect, it } from 'vitest';
import { extractCitedIds, toCitations } from './citations';

describe('extractCitedIds', () => {
  it.each([
    ['Pode sim [1]. Veja também [3].', 6, [1, 3]],
    ['Conforme [2][3]', 6, [2, 3]],
    ['Ver [1, 2]', 6, [1, 2]],
    ['Ver [7]', 6, []],
    ['[2] e de novo [2]', 6, [2]],
    ['[0] não existe', 6, []],
    ['sem citação', 6, []],
  ] as const)('%s', (text, max, ids) => {
    expect(extractCitedIds(text, max)).toEqual(ids);
  });
});

describe('toCitations', () => {
  it('numbers chunks from 1 in relevance order', () => {
    const chunk = {
      id: '0b0f2d3e-8a51-4e5e-9a3c-1f2d3e4a5b6c',
      lawSlug: 'cdc' as const,
      lawShortName: 'CDC',
      path: 'Art. 49',
      article: '49',
      content: 'Art. 49. O consumidor pode desistir.',
      sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
      score: 0.03,
      similarity: 0.6,
    };
    expect(toCitations([chunk, { ...chunk, path: 'Art. 18' }])).toEqual([
      {
        id: 1,
        chunkId: chunk.id,
        lawSlug: 'cdc',
        law: 'CDC',
        path: 'Art. 49',
        content: chunk.content,
        sourceUrl: chunk.sourceUrl,
      },
      expect.objectContaining({ id: 2, path: 'Art. 18' }),
    ]);
  });
});
