import { describe, expect, it } from 'vitest';
import {
  type Expected,
  recallAtK,
  reciprocalRank,
  recommendThreshold,
  refusalTable,
  summarize,
} from './metrics';

const e: Expected[] = [{ law: 'cdc', article: '49' }];
const r18: Expected = { law: 'cdc', article: '18' };
const r49: Expected = { law: 'cdc', article: '49' };

describe('metrics', () => {
  it('recall@k counts hits inside k only', () => {
    expect(recallAtK([r18, r49], e, 1)).toBe(0);
    expect(recallAtK([r18, r49], e, 3)).toBe(1);
  });

  it('recall@k is the fraction of expected articles found', () => {
    expect(recallAtK([r49], [...e, { law: 'cdc', article: '35' }], 6)).toBe(0.5);
  });

  it('reciprocal rank uses the first hit', () => {
    expect(reciprocalRank([r18, r49], e)).toBe(0.5);
    expect(reciprocalRank([], e)).toBe(0);
  });

  it('same article number in another law is not a hit', () => {
    expect(recallAtK([{ law: 'decreto-7962', article: '49' }], e, 6)).toBe(0);
  });

  it('chunks of the same article count once', () => {
    expect(reciprocalRank([r49, r49], e)).toBe(1);
  });

  it('summarize averages over cases', () => {
    expect(
      summarize([
        { retrieved: [r49], expected: e },
        { retrieved: [r18, r49], expected: e },
      ]),
    ).toEqual({ recall1: 0.5, recall3: 1, recall6: 1, mrr: 0.75 });
  });

  it('refusal table: exact matches are never refused', () => {
    expect(
      refusalTable([{ topSimilarity: 0.1, exactMatch: true, outOfScope: false }], [0.5])[0]
        ?.falseRefusals,
    ).toBe(0);
  });

  it('refusal table counts correct and false refusals per threshold', () => {
    const rows = [
      { topSimilarity: 0.4, exactMatch: false, outOfScope: true },
      { topSimilarity: 0.55, exactMatch: false, outOfScope: false },
      { topSimilarity: 0.7, exactMatch: false, outOfScope: false },
    ];
    expect(refusalTable(rows, [0.5, 0.6])).toEqual([
      { threshold: 0.5, correctRefusals: 1, falseRefusals: 0 },
      { threshold: 0.6, correctRefusals: 1, falseRefusals: 1 },
    ]);
  });

  it('recommends the highest threshold within the false refusal budget', () => {
    const table = [
      { threshold: 0.5, correctRefusals: 1, falseRefusals: 0 },
      { threshold: 0.6, correctRefusals: 2, falseRefusals: 1 },
    ];
    expect(recommendThreshold(table, 20, 0.05)).toBe(0.6);
    expect(recommendThreshold(table, 10, 0.05)).toBe(0.5);
  });
});
