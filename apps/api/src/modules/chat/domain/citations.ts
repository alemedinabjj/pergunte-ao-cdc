import type { Citation } from '@cdc/contracts';
import type { RetrievedChunk } from '../../retrieval/domain/retrieval.types';

/** Números citados no texto: "[1]", "[2][3]" ou "[1, 2]". Ignora o que está fora de 1..maxId. */
export function extractCitedIds(text: string, maxId: number): number[] {
  const ids = new Set<number>();
  for (const match of text.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
    for (const part of (match[1] ?? '').split(',')) {
      const id = Number(part.trim());
      if (Number.isInteger(id) && id >= 1 && id <= maxId) ids.add(id);
    }
  }
  return [...ids].sort((a, b) => a - b);
}

export function toCitations(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((chunk, index) => ({
    id: index + 1,
    chunkId: chunk.id,
    lawSlug: chunk.lawSlug,
    law: chunk.lawShortName,
    path: chunk.path,
    content: chunk.content,
    sourceUrl: chunk.sourceUrl,
  }));
}
