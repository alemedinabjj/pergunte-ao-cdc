import type { Citation } from '@cdc/contracts';
import { useEffect, useRef } from 'react';

interface SourcesPanelProps {
  citations: Citation[];
  /** null enquanto a resposta não terminou: todas as fontes ficam visíveis. */
  citedIds: number[] | null;
  selectedId: number | null;
  onSelect(id: number): void;
  loading: boolean;
}

export function SourcesPanel({
  citations,
  citedIds,
  selectedId,
  onSelect,
  loading,
}: SourcesPanelProps) {
  const selectedRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (selectedId !== null)
      selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  if (citations.length === 0) {
    return (
      <p className="text-muted text-sm">
        {loading ? 'Consultando a lei…' : 'Os artigos usados na resposta aparecem aqui.'}
      </p>
    );
  }

  return (
    <ol className="space-y-6">
      {citations.map((citation) => {
        const cited = citedIds === null || citedIds.includes(citation.id);
        const selected = citation.id === selectedId;
        return (
          <li
            key={citation.chunkId}
            ref={selected ? selectedRef : undefined}
            data-testid={`source-${citation.id}`}
            data-cited={String(cited)}
            className={cited ? '' : 'opacity-45'}
          >
            <button
              type="button"
              onClick={() => onSelect(citation.id)}
              className="flex items-baseline gap-2 text-left font-medium text-ink hover:text-seal"
            >
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-seal-soft px-1 text-seal text-xs">
                {citation.id}
              </span>
              {citation.law}, {citation.path}
            </button>
            <p className="mt-2 whitespace-pre-line font-law text-[0.95rem] leading-[1.7]">
              <span className="marker box-decoration-clone px-0.5" data-selected={String(selected)}>
                {citation.content}
              </span>
            </p>
            <a
              href={citation.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-muted text-sm underline decoration-line underline-offset-4 hover:text-seal"
            >
              Ver no planalto.gov.br
            </a>
          </li>
        );
      })}
    </ol>
  );
}
