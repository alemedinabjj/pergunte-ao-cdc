import type { Citation } from '@cdc/contracts';
import Markdown from 'react-markdown';

interface AnswerProps {
  text: string;
  citations: Citation[];
  citedIds: number[] | null;
  streaming: boolean;
  onSelectCitation(id: number): void;
}

const CITATION = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

/** "[1, 2]" vira links #cite-n que o renderer troca por chips; números sem fonte ficam como texto. */
function linkCitations(text: string, known: Set<number>): string {
  return text.replace(CITATION, (_, group: string) =>
    group
      .split(',')
      .map((part) => Number(part.trim()))
      .map((id) => (known.has(id) ? `[${id}](#cite-${id})` : `\\[${id}\\]`))
      .join(''),
  );
}

export function Answer({ text, citations, streaming, onSelectCitation }: AnswerProps) {
  const byId = new Map(citations.map((c) => [c.id, c]));
  return (
    <div className="answer max-w-[68ch] text-[1.0625rem] leading-relaxed [&_p+p]:mt-3 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown
        components={{
          a({ href, children }) {
            const id = href?.startsWith('#cite-') ? Number(href.slice('#cite-'.length)) : null;
            const citation = id === null ? undefined : byId.get(id);
            if (citation) {
              return (
                <button
                  type="button"
                  onClick={() => onSelectCitation(citation.id)}
                  aria-label={`Fonte ${citation.id}: ${citation.law}, ${citation.path}`}
                  title={`${citation.law}, ${citation.path}`}
                  className="mx-0.5 inline-flex h-5 min-w-5 -translate-y-px items-center justify-center rounded-sm bg-seal-soft px-1 align-middle font-medium text-seal text-xs hover:bg-seal hover:text-sheet"
                >
                  {citation.id}
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer" className="text-seal underline">
                {children}
              </a>
            );
          },
        }}
      >
        {linkCitations(text, new Set(byId.keys()))}
      </Markdown>
      {streaming && (
        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-muted align-middle" />
      )}
    </div>
  );
}
