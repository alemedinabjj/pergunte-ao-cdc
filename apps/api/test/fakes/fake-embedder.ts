import { createHash } from 'node:crypto';
import type { Embedder } from '../../src/modules/llm/domain/embedder.port';

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

/**
 * Embedder determinístico para testes: "saco de palavras" com hash em buckets.
 * Textos que compartilham palavras ficam próximos, como num embedder de verdade.
 */
export class FakeEmbedder implements Embedder {
  readonly model = 'fake-embedder';
  readonly calls: string[][] = [];

  constructor(readonly dimensions = 1024) {}

  async embed(texts: string[]): Promise<number[][]> {
    this.calls.push([...texts]);
    return texts.map((text) => this.vectorFor(text));
  }

  private vectorFor(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    for (const token of tokens(text)) {
      const bucket = createHash('sha1').update(token).digest().readUInt32BE(0) % this.dimensions;
      vector[bucket] = (vector[bucket] ?? 0) + 1;
    }
    const sumOfSquares = vector.reduce((sum, v) => sum + v * v, 0);
    if (sumOfSquares === 0) vector[0] = 1;
    const norm = Math.sqrt(sumOfSquares) || 1;
    return vector.map((v) => v / norm);
  }
}
