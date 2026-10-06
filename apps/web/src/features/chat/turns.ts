import type { Citation } from '@cdc/contracts';
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
