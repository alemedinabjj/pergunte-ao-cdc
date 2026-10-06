import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3100),
    DATABASE_URL: z.url(),
    EMBEDDING_PROVIDER: z.enum(['openai', 'ollama']).default('openai'),
    LLM_PROVIDER: z.enum(['openai', 'anthropic', 'ollama']).default('openai'),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_EMBED_MODEL: z.string().min(1).default('text-embedding-3-small'),
    OPENAI_CHAT_MODEL: z.string().min(1).default('gpt-6-luna'),
    OLLAMA_BASE_URL: z.url().default('http://localhost:11434'),
    OLLAMA_EMBED_MODEL: z.string().min(1).default('bge-m3'),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1024),
    OLLAMA_CHAT_MODEL: z.string().min(1).default('qwen2.5:7b'),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_MODEL: z.string().min(1).default('claude-opus-5-5'),
    MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.3),
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
    LAWS_DIR: z.string().min(1).default('../../data/laws'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((env, ctx) => {
    const usesOpenAi = env.EMBEDDING_PROVIDER === 'openai' || env.LLM_PROVIDER === 'openai';
    if (usesOpenAi && !env.OPENAI_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['OPENAI_API_KEY'],
        message: 'obrigatória quando EMBEDDING_PROVIDER ou LLM_PROVIDER é openai',
      });
    }
    if (env.LLM_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['ANTHROPIC_API_KEY'],
        message: 'obrigatória quando LLM_PROVIDER=anthropic',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol('ENV');

export function loadEnv(source: Record<string, string | undefined>): Env {
  const cleaned = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, emptyToUndefined(value)]),
  );
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Variáveis de ambiente inválidas — ${problems}`);
  }
  return result.data;
}
