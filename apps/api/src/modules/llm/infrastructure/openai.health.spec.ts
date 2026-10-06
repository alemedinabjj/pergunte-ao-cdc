import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAiHealth } from './openai.health';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('OpenAiHealth', () => {
  it('caches a successful ping for 60 seconds', async () => {
    const retrieve = vi.fn(async () => ({ id: 'gpt-6-luna' }));
    const health = new OpenAiHealth({ models: { retrieve } }, 'gpt-6-luna');
    expect(await health.ping()).toBe(true);
    expect(await health.ping()).toBe(true);
    expect(retrieve).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(61_000);
    await health.ping();
    expect(retrieve).toHaveBeenCalledTimes(2);
  });

  it('does not cache failures and never throws', async () => {
    const retrieve = vi.fn(async () => {
      throw new Error('401');
    });
    const health = new OpenAiHealth({ models: { retrieve } }, 'gpt-6-luna');
    expect(await health.ping()).toBe(false);
    expect(await health.ping()).toBe(false);
    expect(retrieve).toHaveBeenCalledTimes(2);
    expect(health.unavailableMessage).toContain('OPENAI_API_KEY');
  });
});
