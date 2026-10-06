import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { ChatPage } from '../features/chat/chat-page';
import { turnsFromMessages } from '../features/chat/turns';
import { Sidebar } from '../features/conversations/sidebar';
import { useConversation } from '../features/conversations/use-conversations';
import { ApiError } from '../lib/api-client';

export const Route = createFileRoute('/c/$conversationId')({
  component: function ConversationRoute() {
    const { conversationId } = Route.useParams();
    const conversation = useConversation(conversationId);
    const savedTurns = useMemo(
      () => turnsFromMessages(conversation.data?.messages ?? []),
      [conversation.data],
    );
    const notFound = conversation.error instanceof ApiError && conversation.error.status === 404;

    return (
      <ChatPage
        conversationId={conversationId}
        savedTurns={savedTurns}
        sidebar={<Sidebar activeId={conversationId} />}
        notice={
          notFound ? (
            <p className="pt-16 text-muted">
              Conversa não encontrada.{' '}
              <Link to="/" className="text-seal underline">
                Começar uma nova
              </Link>
            </p>
          ) : undefined
        }
      />
    );
  },
});
