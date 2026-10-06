import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const base = { DATABASE_URL: 'postgres://cdc:cdc@localhost:5433/cdc' };

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv(base);
    expect(env.OLLAMA_CHAT_MODEL).toBe('qwen2.5:3b');
    expect(env.EMBEDDING_DIMENSIONS).toBe(1024);
    expect(env.LLM_PROVIDER).toBe('ollama');
  });

  it('fails without DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('requires ANTHROPIC_API_KEY when provider is anthropic', () => {
    expect(() => loadEnv({ ...base, LLM_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('coerces numeric vars', () => {
    expect(loadEnv({ ...base, MIN_SIMILARITY: '0.62' }).MIN_SIMILARITY).toBe(0.62);
  });

  it('treats empty strings as unset', () => {
    expect(loadEnv({ ...base, ANTHROPIC_API_KEY: '' }).ANTHROPIC_API_KEY).toBeUndefined();
  });
});
