import { describe, expect, it } from 'vitest';
import { chatRequestSchema, sseEventSchema } from './index';

describe('chatRequestSchema', () => {
  it('trims and accepts a valid question', () => {
    expect(chatRequestSchema.parse({ question: '  posso devolver?  ' }).question).toBe(
      'posso devolver?',
    );
  });

  it('rejects questions shorter than 3 or longer than 1000 chars', () => {
    expect(chatRequestSchema.safeParse({ question: 'oi' }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ question: 'a'.repeat(1001) }).success).toBe(false);
  });

  it('rejects unknown law slugs', () => {
    expect(chatRequestSchema.safeParse({ question: 'prazo?', lawSlug: 'clt' }).success).toBe(false);
  });
});

describe('sseEventSchema', () => {
  it('parses each SSE event type and rejects unknown types', () => {
    expect(sseEventSchema.parse({ type: 'token', text: 'a' })).toEqual({
      type: 'token',
      text: 'a',
    });
    expect(
      sseEventSchema.parse({ type: 'done', citedIds: [1], model: null, latencyMs: 10 }).type,
    ).toBe('done');
    expect(sseEventSchema.safeParse({ type: 'ping' }).success).toBe(false);
  });
});
