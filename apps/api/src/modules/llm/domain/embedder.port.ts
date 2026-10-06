export const EMBEDDER = Symbol('EMBEDDER');

export interface Embedder {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>;
}
