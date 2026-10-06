import type { Citation, Message } from '@cdc/contracts';
import type { ChatStatus, ChatStreamState } from './hooks/chat-stream-reducer';

export type TurnStatus = ChatStatus | 'complete' | 'incomplete';

/** Uma pergunta e sua resposta, venha ela do histórico salvo ou do stream ao vivo. */
export interface Turn {
  key: string;
  question: string;
  answer: string;
  citations: Citation[];
  citedIds: number[] | null;
  status: TurnStatus;
  error: string | null;
}

export function liveTurn(state: ChatStreamState): Turn | null {
  if (state.status === 'idle' || state.question === null) return null;
  return {
    key: state.messageId ?? 'live',
    question: state.question,
    answer: state.answer,
    citations: state.citations,
    citedIds: state.citedIds,
    status: state.status,
    error: state.error?.message ?? null,
  };
}

/**
 * Agrupa as mensagens salvas em turnos (pergunta + resposta). Uma pergunta final sem resposta
 * é o turno que ainda está sendo transmitido: ela fica de fora e o stream ao vivo a mostra.
 */
export function turnsFromMessages(messages: Message[]): Turn[] {
  const turns: Turn[] = [];
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message?.role !== 'user') continue;
    const reply = messages[i + 1];
    if (reply?.role !== 'assistant') continue;
    const citations = reply.citations ?? [];
    turns.push({
      key: reply.id,
      question: message.content,
      answer: reply.content,
      citations,
      citedIds: citations.map((c) => c.id),
      status: reply.status,
      error: null,
    });
    i++;
  }
  return turns;
}
