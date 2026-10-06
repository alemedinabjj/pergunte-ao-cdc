import type { LawSlug } from '@cdc/contracts';

export type RetrievalMode = 'hybrid' | 'semantic' | 'keyword';

export interface RetrievedChunk {
  id: string;
  lawSlug: LawSlug;
  lawShortName: string;
  path: string;
  article: string;
  content: string;
  sourceUrl: string;
  /** Score RRF: soma de 1 / (60 + rank) nas listas em que o chunk apareceu. */
  score: number;
  /** Similaridade de cosseno, quando o chunk veio da busca semântica. */
  similarity: number | null;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  /** Melhor similaridade semântica entre os candidatos, usada pela guarda de "não sei". */
  topSimilarity: number | null;
  /** A pergunta citou um artigo que existe ("art. 49"). */
  exactMatch: boolean;
}

export interface SearchQuery {
  text: string;
  embedding: number[] | null;
  lawSlug?: LawSlug;
  mode: RetrievalMode;
  limit: number;
  candidates: number;
}
