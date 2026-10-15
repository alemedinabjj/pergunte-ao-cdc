import { describe, expect, it, vi } from 'vitest';
import { OpenRouterHealth } from './openrouter.health';

describe('OpenRouterHealth', () => {
  it('checks the key endpoint and caches a success', async () => {
    const get = vi.fn(async () => ({ data: { label: 'x' } }));
    const health = new OpenRouterHealth({ get });
    expect(await health.ping()).toBe(true);
    expect(await health.ping()).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(
      '/key',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('reports down when the key is rejected', async () => {
    const health = new OpenRouterHealth({
      get: vi.fn(async () => Promise.reject(new Error('401'))),
    });
    expect(await health.ping()).toBe(false);
    expect(health.unavailableMessage).toContain('OPENROUTER_API_KEY');
  });
});
