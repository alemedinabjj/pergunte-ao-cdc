import { describe, expect, it } from 'vitest';
import { CompositeHealth } from './composite.health';

const stub = (up: boolean, unavailableMessage: string) => ({
  ping: async () => up,
  unavailableMessage,
});

describe('CompositeHealth', () => {
  it('is up only when every provider is up', async () => {
    expect(await new CompositeHealth([stub(true, 'a'), stub(true, 'b')]).ping()).toBe(true);
    expect(await new CompositeHealth([stub(true, 'a'), stub(false, 'b')]).ping()).toBe(false);
  });

  it('reports the message of the first provider that failed', async () => {
    const health = new CompositeHealth([stub(true, 'a'), stub(false, 'b'), stub(false, 'c')]);
    await health.ping();
    expect(health.unavailableMessage).toBe('b');
  });

  it('is up when there is nothing to check', async () => {
    expect(await new CompositeHealth([]).ping()).toBe(true);
  });
});
