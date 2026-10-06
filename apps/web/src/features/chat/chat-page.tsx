import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-client';
import { useChatSession } from './chat-session';
import { Composer } from './components/composer';
import { Disclaimer } from './components/disclaimer';
import { EmptyState } from './components/empty-state';
import { MessageList } from './components/message-list';
import { SourcesPanel } from './components/sources-panel';
import { liveTurn, type Turn } from './turns';

interface ChatPageProps {
  conversationId?: string;
  /** Turnos já salvos (vindos do histórico). */
  savedTurns?: Turn[];
  sidebar?: ReactNode;
  notice?: ReactNode;
}

export function ChatPage({ conversationId, savedTurns = [], sidebar, notice }: ChatPageProps) {
  const session = useChatSession();
  const laws = useQuery({ queryKey: queryKeys.laws, queryFn: api.laws });
  const [selection, setSelection] = useState<{ turnKey: string; citationId: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const live = liveTurn(session.state);
  const belongsHere =
    live &&
    (session.state.conversationId ?? null) === (conversationId ?? session.state.conversationId);
  const turns = useMemo(
    () =>
      belongsHere && live ? [...savedTurns.filter((t) => t.key !== live.key), live] : savedTurns,
    [savedTurns, live, belongsHere],
  );

  const activeTurn =
    turns.find((t) => t.key === selection?.turnKey) ?? turns[turns.length - 1] ?? null;
  const busy = session.state.status === 'retrieving' || session.state.status === 'streaming';

  useEffect(() => {
    if (turns.length > 0) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [turns.length]);

  const ask = (question: string, lawSlug?: Parameters<typeof session.send>[0]['lawSlug']) => {
    setSelection(null);
    session.send({ question, lawSlug, conversationId });
  };

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)_23rem]">
      <aside className="hidden border-line border-r lg:block">{sidebar}</aside>

      <main className="flex min-h-0 flex-col">
        <header className="flex items-center gap-3 px-6 py-4">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-sm bg-seal font-law text-marker"
          >
            §
          </span>
          <span className="font-semibold">Pergunte ao CDC</span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          {notice}
          {turns.length === 0 && !notice ? (
            <EmptyState onPick={(question) => ask(question)} />
          ) : (
            <MessageList
              turns={turns}
              onSelectCitation={(turnKey, citationId) => setSelection({ turnKey, citationId })}
            />
          )}
          {activeTurn && activeTurn.citations.length > 0 && (
            <section className="border-line border-t py-6 lg:hidden">
              <h2 className="mb-4 font-semibold">Fontes</h2>
              <SourcesPanel
                citations={activeTurn.citations}
                citedIds={activeTurn.citedIds}
                selectedId={selection?.turnKey === activeTurn.key ? selection.citationId : null}
                onSelect={(citationId) => setSelection({ turnKey: activeTurn.key, citationId })}
                loading={false}
              />
            </section>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="px-6 pt-2 pb-4">
          <Composer laws={laws.data ?? []} busy={busy} onSubmit={ask} onStop={session.stop} />
          <Disclaimer />
        </div>
      </main>

      <aside className="hidden min-h-0 overflow-y-auto border-line border-l bg-sheet px-6 py-6 lg:block">
        <h2 className="mb-5 font-semibold">Fontes</h2>
        <SourcesPanel
          citations={activeTurn?.citations ?? []}
          citedIds={activeTurn?.citedIds ?? null}
          selectedId={
            selection && activeTurn && selection.turnKey === activeTurn.key
              ? selection.citationId
              : null
          }
          onSelect={(citationId) =>
            activeTurn && setSelection({ turnKey: activeTurn.key, citationId })
          }
          loading={activeTurn?.status === 'retrieving'}
        />
      </aside>
    </div>
  );
}
