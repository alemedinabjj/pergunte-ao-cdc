import OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import { LlmRequestError, LlmUnavailableError } from '../domain/errors';
import { mapOpenAiError } from './openai.errors';

describe('mapOpenAiError', () => {
  it('maps connection failures, rate limits and 5xx to LlmUnavailableError', () => {
    expect(mapOpenAiError(new OpenAI.APIConnectionError({ message: 'x' }))).toBeInstanceOf(
      LlmUnavailableError,
    );
    expect(
      mapOpenAiError(new OpenAI.RateLimitError(429, undefined, 'slow', new Headers())),
    ).toBeInstanceOf(LlmUnavailableError);
    expect(
      mapOpenAiError(new OpenAI.APIError(503, undefined, 'down', new Headers())),
    ).toBeInstanceOf(LlmUnavailableError);
  });

  it('points to OPENAI_API_KEY on authentication errors', () => {
    const mapped = mapOpenAiError(
      new OpenAI.AuthenticationError(401, undefined, 'bad', new Headers()),
    );
    expect(mapped).toBeInstanceOf(LlmUnavailableError);
    expect((mapped as Error).message).toContain('OPENAI_API_KEY');
  });

  it('maps other 4xx to LlmRequestError', () => {
    expect(
      mapOpenAiError(new OpenAI.APIError(400, undefined, 'bad', new Headers())),
    ).toBeInstanceOf(LlmRequestError);
  });

  it('turns user aborts into AbortError', () => {
    expect((mapOpenAiError(new OpenAI.APIUserAbortError()) as Error).name).toBe('AbortError');
  });

  it('passes unknown errors through', () => {
    const error = new Error('boom');
    expect(mapOpenAiError(error)).toBe(error);
  });
});
