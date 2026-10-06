import type { LawSlug } from '@cdc/contracts';

export interface Expected {
  law: LawSlug;
  article: string;
}

export interface EvalCase {
  question: string;
  expected: Expected[];
  tags: ('coloquial' | 'ref-exata' | 'fora-do-escopo')[];
}

const key = (item: Expected) => `${item.law}:${item.article}`;

/** Remove repetições (vários chunks do mesmo artigo) preservando a ordem. */
function uniqueArticles(retrieved: Expected[]): string[] {
  return [...new Set(retrieved.map(key))];
}

export function recallAtK(retrieved: Expected[], expected: Expected[], k: number): number {
  if (expected.length === 0) return 0;
  const top = new Set(uniqueArticles(retrieved).slice(0, k));
  return expected.filter((item) => top.has(key(item))).length / expected.length;
}

export function reciprocalRank(retrieved: Expected[], expected: Expected[]): number {
  const wanted = new Set(expected.map(key));
  const index = uniqueArticles(retrieved).findIndex((item) => wanted.has(item));
  return index === -1 ? 0 : 1 / (index + 1);
}

export function summarize(rows: { retrieved: Expected[]; expected: Expected[] }[]): {
  recall1: number;
  recall3: number;
  recall6: number;
  mrr: number;
} {
  const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / (values.length || 1);
  return {
    recall1: mean(rows.map((r) => recallAtK(r.retrieved, r.expected, 1))),
    recall3: mean(rows.map((r) => recallAtK(r.retrieved, r.expected, 3))),
    recall6: mean(rows.map((r) => recallAtK(r.retrieved, r.expected, 6))),
    mrr: mean(rows.map((r) => reciprocalRank(r.retrieved, r.expected))),
  };
}

export interface RefusalRow {
  threshold: number;
  correctRefusals: number;
  falseRefusals: number;
}

/** Mesma regra da guarda do chat: recusa quando não há match exato e a similaridade é baixa. */
export function refusalTable(
  rows: { topSimilarity: number | null; exactMatch: boolean; outOfScope: boolean }[],
  thresholds: number[],
): RefusalRow[] {
  return thresholds.map((threshold) => {
    const refused = rows.filter((r) => !r.exactMatch && (r.topSimilarity ?? 0) < threshold);
    return {
      threshold,
      correctRefusals: refused.filter((r) => r.outOfScope).length,
      falseRefusals: refused.filter((r) => !r.outOfScope).length,
    };
  });
}

/** Maior limiar cujas recusas indevidas ficam dentro do orçamento (ex.: 5% das perguntas válidas). */
export function recommendThreshold(
  table: RefusalRow[],
  inScopeCount: number,
  maxFalseRefusalRate: number,
): number | null {
  const ok = table.filter((row) => row.falseRefusals / inScopeCount <= maxFalseRefusalRate);
  return ok.length > 0 ? Math.max(...ok.map((row) => row.threshold)) : null;
}

export function reportHeader(input: {
  date: string;
  embeddingModel: string;
  total: number;
  inScope: number;
}): string[] {
  return [
    '# Avaliação do retrieval',
    '',
    `- Data: ${input.date}`,
    `- Modelo de embeddings: \`${input.embeddingModel}\``,
    `- Perguntas: ${input.total} (${input.inScope} dentro do escopo, ${input.total - input.inScope} fora)`,
  ];
}
