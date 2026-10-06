import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { createContext, type ReactNode, useCallback, useContext, useRef } from 'react';
import { queryKeys } from '../../lib/query-client';
import { type ChatStream, useChatStream } from './hooks/use-chat-stream';

const ChatSessionContext = createContext<ChatStream | null>(null);

/**
 * Mora no layout raiz: o stream sobrevive à troca de rota de "/" para "/c/:id" quando a
 * conversa nova é criada no meio da resposta. Ao terminar, recarrega o histórico salvo e só
 * então limpa o turno ao vivo, para a resposta não piscar nem aparecer duas vezes.
 */
export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const resetRef = useRef<() => void>(() => undefined);

  const stream = useChatStream({
    onMeta: ({ conversationId }) => {
      void navigate({ to: '/c/$conversationId', params: { conversationId }, replace: true });
    },
    onDone: async (conversationId) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      await queryClient.refetchQueries({ queryKey: queryKeys.conversation(conversationId) });
      resetRef.current();
    },
  });
  resetRef.current = stream.reset;

  return <ChatSessionContext.Provider value={stream}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession(): ChatStream {
  const session = useContext(ChatSessionContext);
  if (!session) throw new Error('useChatSession precisa de um ChatSessionProvider');
  return session;
}

/** Para o que estiver em andamento, limpa o turno ao vivo e volta para a tela inicial. */
export function useStartNewConversation(): () => void {
  const session = useChatSession();
  const navigate = useNavigate();
  return useCallback(() => {
    session.stop();
    session.reset();
    void navigate({ to: '/' });
  }, [session, navigate]);
}
