import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import { EMBEDDER } from './domain/embedder.port';
import { LLM_CLIENT, type LlmClient } from './domain/llm-client.port';
import { AnthropicLlmClient } from './infrastructure/anthropic.llm-client';
import { OllamaEmbedder } from './infrastructure/ollama.embedder';
import { OllamaHealth } from './infrastructure/ollama.health';
import { OllamaLlmClient } from './infrastructure/ollama.llm-client';

@Global()
@Module({
  providers: [
    {
      provide: EMBEDDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        new OllamaEmbedder({
          baseUrl: env.OLLAMA_BASE_URL,
          model: env.OLLAMA_EMBED_MODEL,
          dimensions: env.EMBEDDING_DIMENSIONS,
        }),
    },
    {
      provide: LLM_CLIENT,
      inject: [ENV],
      useFactory: (env: Env): LlmClient =>
        env.LLM_PROVIDER === 'anthropic' && env.ANTHROPIC_API_KEY
          ? new AnthropicLlmClient({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL })
          : new OllamaLlmClient({ baseUrl: env.OLLAMA_BASE_URL, model: env.OLLAMA_CHAT_MODEL }),
    },
    {
      provide: OllamaHealth,
      inject: [ENV],
      useFactory: (env: Env) => new OllamaHealth(env.OLLAMA_BASE_URL),
    },
  ],
  exports: [EMBEDDER, LLM_CLIENT, OllamaHealth],
})
export class LlmModule {}
