import type { ChatRequest } from '@cdc/contracts';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { apiUrl, toApiError } from '../../../lib/api-client';
import { type ChatStreamState, chatStreamReducer, initialChatState } from './chat-stream-reducer';
import { readSseStream } from './read-sse-stream';

export interface ChatStreamCallbacks {
  /** Chega antes de qualquer token; numa conversa nova, traz o id criado. */
  onMeta?: (meta: { conversationId: string }) => void;
  /** Chamado quando a resposta termina (com sucesso ou erro) e já está salva. */
  onDone?: (conversationId: string) => void;
}

export interface ChatStream {
  state: ChatStreamState;
  send(input: ChatRequest): void;
  stop(): void;
  reset(): void;
}

export function useChatStream(callbacks: ChatStreamCallbacks = {}): ChatStream {
  const [state, dispatch] = useReducer(chatStreamReducer, initialChatState);
  const controllerRef = useRef<AbortController | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => () => controllerRef.current?.abort(), []);

  const send = useCallback((input: ChatRequest) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    dispatch({ type: 'send', question: input.question });

    void (async () => {
      let conversationId: string | null = null;
      let finished = false;
      try {
        const response = await fetch(apiUrl('/api/chat'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          const error = await toApiError(response);
          dispatch({ type: 'failed', code: error.code, message: error.message });
          return;
        }
        await readSseStream(
          response.body,
          (event) => {
            dispatch({ type: 'event', event });
            if (event.type === 'done' || event.type === 'error') finished = true;
            if (event.type === 'meta') {
              conversationId = event.conversationId;
              callbacksRef.current.onMeta?.({ conversationId: event.conversationId });
            }
          },
          controller.signal,
        );
        if (controller.signal.aborted) dispatch({ type: 'aborted' });
        else if (!finished) {
          dispatch({
            type: 'failed',
            code: 'STREAM_ENDED',
            message: 'A resposta foi interrompida antes do fim. Tente de novo.',
          });
        }
        if (conversationId) callbacksRef.current.onDone?.(conversationId);
      } catch {
        if (controller.signal.aborted) {
          dispatch({ type: 'aborted' });
          if (conversationId) callbacksRef.current.onDone?.(conversationId);
          return;
        }
        dispatch({
          type: 'failed',
          code: 'NETWORK',
          message: 'Não consegui falar com a API. Ela está rodando?',
        });
      }
    })();
  }, []);

  const stop = useCallback(() => controllerRef.current?.abort(), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  return { state, send, stop, reset };
}
