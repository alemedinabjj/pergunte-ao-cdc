import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { CONVERSATION_ID, cit, MESSAGE_ID, sseBody, streamOf } from '../../../test/fixtures';
import { server } from '../../../test/msw';
import { useChatStream } from './use-chat-stream';

const sseResponse = (chunks: string[], delayMs = 0) =>
  new HttpResponse(streamOf(chunks, delayMs), { headers: { 'content-type': 'text/event-stream' } });

describe('useChatStream', () => {
  it('streams a full turn and calls onMeta and onDone', async () => {
    let body: unknown;
    server.use(
      http.post('/api/chat', async ({ request }) => {
        body = await request.json();
        return sseResponse([
          sseBody([
            { type: 'meta', conversationId: CONVERSATION_ID, messageId: MESSAGE_ID },
            { type: 'citations', items: [cit()] },
            { type: 'token', text: 'Pode [1].' },
            { type: 'done', citedIds: [1], model: 'm', latencyMs: 5 },
          ]),
        ]);
      }),
    );
    const onMeta = vi.fn();
    const onDone = vi.fn();
    const { result } = renderHook(() => useChatStream({ onMeta, onDone }));
    act(() => result.current.send({ question: 'posso devolver?', lawSlug: 'cdc' }));
    await waitFor(() => expect(result.current.state.status).toBe('done'));
    expect(result.current.state).toMatchObject({ answer: 'Pode [1].', citedIds: [1] });
    expect(body).toEqual({ question: 'posso devolver?', lawSlug: 'cdc' });
    expect(onMeta).toHaveBeenCalledWith({ conversationId: CONVERSATION_ID });
    expect(onDone).toHaveBeenCalledWith(CONVERSATION_ID);
  });

  it('moves to error with the server message on 503', async () => {
    server.use(
      http.post('/api/chat', () =>
        HttpResponse.json(
          { code: 'LLM_UNAVAILABLE', message: 'Confira a OPENAI_API_KEY.' },
          { status: 503 },
        ),
      ),
    );
    const { result } = renderHook(() => useChatStream());
    act(() => result.current.send({ question: 'posso devolver?' }));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.error).toEqual({
      code: 'LLM_UNAVAILABLE',
      message: 'Confira a OPENAI_API_KEY.',
    });
  });

  it('stop() aborts and sets aborted', async () => {
    server.use(
      http.post('/api/chat', () =>
        sseResponse(
          [
            sseBody([{ type: 'meta', conversationId: CONVERSATION_ID, messageId: MESSAGE_ID }]),
            sseBody([{ type: 'token', text: 'a' }]),
            sseBody([{ type: 'token', text: 'b' }]),
          ],
          80,
        ),
      ),
    );
    const { result } = renderHook(() => useChatStream());
    act(() => result.current.send({ question: 'posso devolver?' }));
    await waitFor(() => expect(result.current.state.conversationId).toBe(CONVERSATION_ID));
    act(() => result.current.stop());
    await waitFor(() => expect(result.current.state.status).toBe('aborted'));
  });

  it('handles an error event in the middle of the stream', async () => {
    server.use(
      http.post('/api/chat', () =>
        sseResponse([
          sseBody([
            { type: 'meta', conversationId: CONVERSATION_ID, messageId: MESSAGE_ID },
            { type: 'citations', items: [cit()] },
            { type: 'token', text: 'Pod' },
            { type: 'error', code: 'LLM_FAILED', message: 'O modelo falhou.' },
          ]),
        ]),
      ),
    );
    const onDone = vi.fn();
    const { result } = renderHook(() => useChatStream({ onDone }));
    act(() => result.current.send({ question: 'posso devolver?' }));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state).toMatchObject({ answer: 'Pod', error: { code: 'LLM_FAILED' } });
    expect(onDone).toHaveBeenCalledWith(CONVERSATION_ID);
  });

  it('reports a network failure as an error', async () => {
    server.use(http.post('/api/chat', () => HttpResponse.error()));
    const { result } = renderHook(() => useChatStream());
    act(() => result.current.send({ question: 'posso devolver?' }));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state.error?.code).toBe('NETWORK');
  });
});

describe('useChatStream when the stream ends abruptly', () => {
  it('moves to error if the body ends without done or error', async () => {
    server.use(
      http.post('/api/chat', () =>
        sseResponse([
          sseBody([
            { type: 'meta', conversationId: CONVERSATION_ID, messageId: MESSAGE_ID },
            { type: 'citations', items: [cit()] },
            { type: 'token', text: 'Pod' },
          ]),
        ]),
      ),
    );
    const { result } = renderHook(() => useChatStream());
    act(() => result.current.send({ question: 'posso devolver?' }));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state).toMatchObject({ answer: 'Pod', error: { code: 'STREAM_ENDED' } });
  });
});
