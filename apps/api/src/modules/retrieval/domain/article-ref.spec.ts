import { describe, expect, it } from 'vitest';
import { extractArticleRef } from './article-ref';

describe('extractArticleRef', () => {
  it.each([
    ['o que diz o art. 49?', '49'],
    ['artigo 18 do CDC', '18'],
    ['Art 54-A', '54-A'],
    ['art. 54-a', '54-A'],
    ['art.6º', '6'],
    ['Artigo 6°, inciso III', '6'],
    ['quanto tempo para devolver?', null],
    ['parte do contrato', null],
  ])('%s → %s', (input, expected) => {
    expect(extractArticleRef(input)).toBe(expected);
  });
});
