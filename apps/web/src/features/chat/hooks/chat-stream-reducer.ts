import type { Citation, SseEvent } from '@cdc/contracts';

export type ChatStatus = 'idle' | 'retrieving' | 'streaming' | 'done' | 'error' | 'aborted';

export interface ChatStreamState {
  status: ChatStatus;
  question: string | null;
  conversationId: string | null;
  messageId: string | null;
  citations: Citation[];
  answer: string;
  /** null enquanto a resposta não terminou; depois, as fontes realmente citadas. */
  citedIds: number[] | null;
  error: { code: string; message: string } | null;
}

export type ChatAction =
  | { type: 'send'; question: string }
  | { type: 'event'; event: SseEvent }
  | { type: 'aborted' }
  | { type: 'failed'; code: string; message: string }
  | { type: 'reset' };

export const initialChatState: ChatStreamState = {
  status: 'idle',
  question: null,
  conversationId: null,
  messageId: null,
  citations: [],
  answer: '',
  citedIds: null,
  error: null,
};

function applyEvent(state: ChatStreamState, event: SseEvent): ChatStreamState {
  switch (event.type) {
    case 'meta':
      return { ...state, conversationId: event.conversationId, messageId: event.messageId };
    case 'citations':
      return { ...state, status: 'streaming', citations: event.items };
    case 'token':
      return { ...state, status: 'streaming', answer: state.answer + event.text };
    case 'done':
      return { ...state, status: 'done', citedIds: event.citedIds };
    case 'error':
      return { ...state, status: 'error', error: { code: event.code, message: event.message } };
  }
}

export function chatStreamReducer(state: ChatStreamState, action: ChatAction): ChatStreamState {
  switch (action.type) {
    case 'send':
      return { ...initialChatState, status: 'retrieving', question: action.question };
    case 'event':
      return applyEvent(state, action.event);
    case 'aborted':
      return { ...state, status: 'aborted' };
    case 'failed':
      return { ...state, status: 'error', error: { code: action.code, message: action.message } };
    case 'reset':
      return initialChatState;
  }
}
