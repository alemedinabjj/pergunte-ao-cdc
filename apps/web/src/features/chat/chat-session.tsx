import { createContext, type ReactNode, useContext } from 'react';
import { type ChatStream, type ChatStreamCallbacks, useChatStream } from './hooks/use-chat-stream';

const ChatSessionContext = createContext<ChatStream | null>(null);

/**
 * Mora no layout raiz: o stream sobrevive à troca de rota de "/" para "/c/:id"
 * quando a conversa nova é criada no meio da resposta.
 */
export function ChatSessionProvider({
  children,
  ...callbacks
}: ChatStreamCallbacks & { children: ReactNode }) {
  const stream = useChatStream(callbacks);
  return <ChatSessionContext.Provider value={stream}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession(): ChatStream {
  const session = useContext(ChatSessionContext);
  if (!session) throw new Error('useChatSession precisa de um ChatSessionProvider');
  return session;
}
