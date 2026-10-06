import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LlmRequestError, LlmUnavailableError } from './domain/errors';
import { withRetry } from './retry';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('withRetry', () => {
  it('retries LlmUnavailableError and succeeds on a later attempt', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new LlmUnavailableError('down'))
      .mockResolvedValueOnce('ok');
    const promise = withRetry(fn, { baseMs: 10 });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives up after 3 attempts', async () => {
    const fn = vi.fn(async () => {
      throw new LlmUnavailableError('down');
    });
    const promise = withRetry(fn, { baseMs: 10 });
    const assertion = expect(promise).rejects.toBeInstanceOf(LlmUnavailableError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry LlmRequestError', async () => {
    const fn = vi.fn(async () => {
      throw new LlmRequestError('bad');
    });
    await expect(withRetry(fn)).rejects.toBeInstanceOf(LlmRequestError);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
