import type { Law, LawSlug } from '@cdc/contracts';
import { type FormEvent, type KeyboardEvent, useState } from 'react';

interface ComposerProps {
  laws: Law[];
  busy: boolean;
  onSubmit(question: string, lawSlug?: LawSlug): void;
  onStop(): void;
}

const MIN_LENGTH = 3;

export function Composer({ laws, busy, onSubmit, onStop }: ComposerProps) {
  const [question, setQuestion] = useState('');
  const [lawSlug, setLawSlug] = useState<LawSlug | ''>('');
  const ready = question.trim().length >= MIN_LENGTH;

  const submit = () => {
    if (!ready || busy) return;
    onSubmit(question.trim(), lawSlug || undefined);
    setQuestion('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        submit();
      }}
      className="rounded-md border border-line bg-sheet p-3 focus-within:border-seal"
    >
      <label htmlFor="question" className="sr-only">
        Sua pergunta
      </label>
      <textarea
        id="question"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={onKeyDown}
        rows={2}
        maxLength={1000}
        placeholder="Ex.: comprei pela internet e me arrependi. Posso devolver?"
        className="w-full resize-none bg-transparent text-[1.0625rem] outline-none placeholder:text-muted"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-muted text-sm">
          <span>Lei</span>
          <select
            value={lawSlug}
            onChange={(event) => setLawSlug(event.target.value as LawSlug | '')}
            className="rounded-sm border border-line bg-paper px-2 py-1 text-ink"
          >
            <option value="">Todas as leis</option>
            {laws.map((law) => (
              <option key={law.slug} value={law.slug}>
                {law.shortName}
              </option>
            ))}
          </select>
        </label>
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded-sm border border-ink px-4 py-1.5 font-medium text-sm hover:bg-ink hover:text-paper"
          >
            Parar
          </button>
        ) : (
          <button
            type="submit"
            disabled={!ready}
            className="rounded-sm bg-seal px-4 py-1.5 font-medium text-sheet text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Perguntar
          </button>
        )}
      </div>
    </form>
  );
}
