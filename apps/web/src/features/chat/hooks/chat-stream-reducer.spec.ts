import { describe, expect, it } from 'vitest';
import { CONVERSATION_ID, cit, MESSAGE_ID } from '../../../test/fixtures';
import { chatStreamReducer, initialChatState } from './chat-stream-reducer';

describe('chatStreamReducer', () => {
  it('walks idle → retrieving → streaming → done', () => {
    let s = chatStreamReducer(initialChatState, { type: 'send', question: 'q' });
    expect(s).toMatchObject({ status: 'retrieving', question: 'q' });
    s = chatStreamReducer(s, {
      type: 'event',
      event: { type: 'meta', conversationId: CONVERSATION_ID, messageId: MESSAGE_ID },
    });
    expect(s.conversationId).toBe(CONVERSATION_ID);
    s = chatStreamReducer(s, { type: 'event', event: { type: 'citations', items: [cit()] } });
    expect(s.status).toBe('streaming');
    s = chatStreamReducer(s, { type: 'event', event: { type: 'token', text: 'Pode' } });
    s = chatStreamReducer(s, { type: 'event', event: { type: 'token', text: ' sim' } });
    s = chatStreamReducer(s, {
      type: 'event',
      event: { type: 'done', citedIds: [1], model: 'm', latencyMs: 1 },
    });
    expect(s).toMatchObject({ status: 'done', answer: 'Pode sim', citedIds: [1] });
  });

  it('send clears the previous turn', () => {
    const previous = { ...initialChatState, answer: 'antiga', citations: [cit()], citedIds: [1] };
    expect(chatStreamReducer(previous, { type: 'send', question: 'nova' })).toMatchObject({
      answer: '',
      citations: [],
      citedIds: null,
    });
  });

  it('error event and failed both end in error', () => {
    const streaming = { ...initialChatState, status: 'streaming' as const };
    expect(
      chatStreamReducer(streaming, {
        type: 'event',
        event: { type: 'error', code: 'TIMEOUT', message: 'demorou' },
      }),
    ).toMatchObject({ status: 'error', error: { code: 'TIMEOUT', message: 'demorou' } });
    expect(chatStreamReducer(streaming, { type: 'failed', code: 'X', message: 'y' }).status).toBe(
      'error',
    );
  });

  it('aborted and reset', () => {
    const streaming = { ...initialChatState, status: 'streaming' as const, answer: 'meio' };
    expect(chatStreamReducer(streaming, { type: 'aborted' })).toMatchObject({
      status: 'aborted',
      answer: 'meio',
    });
    expect(chatStreamReducer(streaming, { type: 'reset' })).toEqual(initialChatState);
  });
});
