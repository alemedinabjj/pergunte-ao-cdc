import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const base = { DATABASE_URL: 'postgres://cdc:cdc@localhost:5439/cdc', OPENAI_API_KEY: 'sk-test' };
const local = {
  DATABASE_URL: base.DATABASE_URL,
  EMBEDDING_PROVIDER: 'ollama',
  LLM_PROVIDER: 'ollama',
};

describe('loadEnv', () => {
  it('defaults to OpenAI for embeddings and generation', () => {
    const env = loadEnv(base);
    expect(env.EMBEDDING_PROVIDER).toBe('openai');
    expect(env.LLM_PROVIDER).toBe('openai');
    expect(env.OPENAI_EMBED_MODEL).toBe('text-embedding-3-small');
    expect(env.OPENAI_CHAT_MODEL).toBe('gpt-6-luna');
    expect(env.EMBEDDING_DIMENSIONS).toBe(1024);
  });

  it('fails without DATABASE_URL', () => {
    expect(() => loadEnv({ OPENAI_API_KEY: 'sk-test' })).toThrow(/DATABASE_URL/);
  });

  it('requires OPENAI_API_KEY when any provider is openai', () => {
    expect(() => loadEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow(/OPENAI_API_KEY/);
    expect(() => loadEnv({ ...local, LLM_PROVIDER: 'openai' })).toThrow(/OPENAI_API_KEY/);
  });

  it('runs fully local with Ollama and no keys', () => {
    const env = loadEnv(local);
    expect(env.OLLAMA_CHAT_MODEL).toBe('qwen2.5:7b');
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  it('requires ANTHROPIC_API_KEY when provider is anthropic', () => {
    expect(() => loadEnv({ ...base, LLM_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('uses a conservative similarity threshold until the OpenAI eval calibrates it', () => {
    expect(loadEnv(base).MIN_SIMILARITY).toBe(0.3);
  });

  it('requires OPENROUTER_API_KEY when a provider is openrouter and defaults to free models', () => {
    const { OPENAI_API_KEY: _, ...noKey } = base;
    expect(() =>
      loadEnv({ ...noKey, EMBEDDING_PROVIDER: 'openrouter', LLM_PROVIDER: 'openrouter' }),
    ).toThrow('OPENROUTER_API_KEY');
    const env = loadEnv({
      ...noKey,
      EMBEDDING_PROVIDER: 'openrouter',
      LLM_PROVIDER: 'openrouter',
      OPENROUTER_API_KEY: 'sk-or-test',
    });
    expect(env.OPENROUTER_CHAT_MODEL).toBe('google/gemma-4-31b-it:free');
    expect(env.OPENROUTER_EMBED_MODEL).toBe('liquid/lfm-2.5-embedding-350m:free');
  });

  it('coerces numeric vars', () => {
    expect(loadEnv({ ...base, MIN_SIMILARITY: '0.62' }).MIN_SIMILARITY).toBe(0.62);
  });

  it('treats empty strings as unset', () => {
    expect(loadEnv({ ...base, ANTHROPIC_API_KEY: '' }).ANTHROPIC_API_KEY).toBeUndefined();
  });
});
