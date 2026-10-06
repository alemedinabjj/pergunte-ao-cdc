import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useStartNewConversation } from '../chat/chat-session';
import { useConversations, useDeleteConversation } from './use-conversations';

export function Sidebar({ activeId }: { activeId?: string }) {
  const conversations = useConversations();
  const remove = useDeleteConversation();
  const navigate = useNavigate();
  const startNew = useStartNewConversation();
  const [confirming, setConfirming] = useState<{ id: string; title: string } | null>(null);

  const confirmDelete = async () => {
    if (!confirming) return;
    await remove.mutateAsync(confirming.id);
    if (confirming.id === activeId) await navigate({ to: '/' });
    setConfirming(null);
  };

  return (
    <div className="flex h-full flex-col px-3 py-4">
      <button
        type="button"
        onClick={startNew}
        className="mb-4 rounded-sm border border-line px-3 py-2 text-left font-medium text-sm hover:border-seal hover:text-seal"
      >
        Nova conversa
      </button>

      <nav aria-label="Conversas" className="min-h-0 flex-1 overflow-y-auto">
        {conversations.data?.length === 0 && (
          <p className="px-2 text-muted text-sm">Suas conversas ficam aqui.</p>
        )}
        <ul className="space-y-0.5">
          {conversations.data?.map((conversation) => {
            const active = conversation.id === activeId;
            return (
              <li key={conversation.id} className="group flex items-center gap-1">
                <Link
                  to="/c/$conversationId"
                  params={{ conversationId: conversation.id }}
                  aria-current={active ? 'page' : undefined}
                  className={`min-w-0 flex-1 truncate rounded-sm px-2 py-1.5 text-sm ${
                    active ? 'bg-seal-soft text-seal' : 'hover:bg-sheet'
                  }`}
                >
                  {conversation.title}
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirming({ id: conversation.id, title: conversation.title })}
                  aria-label={`Excluir conversa: ${conversation.title}`}
                  className="rounded-sm px-1.5 py-1 text-muted opacity-0 hover:text-alert focus-visible:opacity-100 group-hover:opacity-100"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {confirming && (
        <div
          role="alertdialog"
          aria-labelledby="confirm-delete-title"
          className="mt-3 rounded-sm border border-line bg-sheet p-3 text-sm"
        >
          <p id="confirm-delete-title" className="font-medium">
            Excluir esta conversa?
          </p>
          <p className="mt-1 truncate text-muted">{confirming.title}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={confirmDelete}
              disabled={remove.isPending}
              className="rounded-sm bg-alert px-3 py-1 font-medium text-sheet"
            >
              Excluir
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="rounded-sm border border-line px-3 py-1"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
