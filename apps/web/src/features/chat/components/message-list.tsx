import type { Turn } from '../turns';
import { Answer } from './answer';

interface MessageListProps {
  turns: Turn[];
  onSelectCitation(turnKey: string, citationId: number): void;
}

const STATUS_NOTE: Partial<Record<Turn['status'], string>> = {
  retrieving: 'Consultando a lei…',
  aborted: 'Resposta interrompida.',
  incomplete: 'Resposta interrompida.',
};

export function MessageList({ turns, onSelectCitation }: MessageListProps) {
  return (
    <div className="space-y-12 py-8" aria-live="polite">
      {turns.map((turn) => (
        <article key={turn.key} className="space-y-4">
          <h2 className="max-w-[60ch] font-semibold text-lg leading-snug">{turn.question}</h2>
          {turn.answer && (
            <Answer
              text={turn.answer}
              citations={turn.citations}
              citedIds={turn.citedIds}
              streaming={turn.status === 'streaming'}
              onSelectCitation={(id) => onSelectCitation(turn.key, id)}
            />
          )}
          {STATUS_NOTE[turn.status] && (
            <p className="text-muted text-sm">{STATUS_NOTE[turn.status]}</p>
          )}
          {turn.status === 'error' && turn.error && (
            <p role="alert" className="border-alert border-l-2 pl-3 text-alert text-sm">
              {turn.error}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
