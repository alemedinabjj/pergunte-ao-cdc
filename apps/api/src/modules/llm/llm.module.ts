import { Global, Module } from '@nestjs/common';
import OpenAI from 'openai';
import { ENV, type Env } from '../../config/env';
import { EMBEDDER, type Embedder } from './domain/embedder.port';
import { LLM_CLIENT, type LlmClient } from './domain/llm-client.port';
import { LLM_HEALTH, type LlmHealth } from './domain/llm-health.port';
import { AnthropicLlmClient } from './infrastructure/anthropic.llm-client';
import { CompositeHealth } from './infrastructure/composite.health';
import { OllamaEmbedder } from './infrastructure/ollama.embedder';
import { OllamaHealth } from './infrastructure/ollama.health';
import { OllamaLlmClient } from './infrastructure/ollama.llm-client';
import { OpenAiEmbedder } from './infrastructure/openai.embedder';
import { OPENROUTER } from './infrastructure/openai.errors';
import { OpenAiHealth } from './infrastructure/openai.health';
import { OpenAiLlmClient } from './infrastructure/openai.llm-client';
import { OpenRouterHealth } from './infrastructure/openrouter.health';
import { OpenRouterLlmClient } from './infrastructure/openrouter.llm-client';

const OPENAI_CLIENT = Symbol('OPENAI_CLIENT');
const OPENROUTER_CLIENT = Symbol('OPENROUTER_CLIENT');

function requireOpenAi(client: OpenAI | null): OpenAI {
  if (!client) throw new Error('OPENAI_API_KEY ausente');
  return client;
}

function requireOpenRouter(client: OpenAI | null): OpenAI {
  if (!client) throw new Error('OPENROUTER_API_KEY ausente');
  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: OPENAI_CLIENT,
      inject: [ENV],
      useFactory: (env: Env): OpenAI | null =>
        env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null,
    },
    {
      // A OpenRouter fala o protocolo da OpenAI: o mesmo SDK, com outro endereço.
      provide: OPENROUTER_CLIENT,
      inject: [ENV],
      useFactory: (env: Env): OpenAI | null =>
        env.OPENROUTER_API_KEY
          ? new OpenAI({
              apiKey: env.OPENROUTER_API_KEY,
              baseURL: 'https://openrouter.ai/api/v1',
              defaultHeaders: {
                'HTTP-Referer': 'https://github.com/alemedinabjj/pergunte-ao-cdc',
                'X-Title': 'Pergunte ao CDC',
              },
            })
          : null,
    },
    {
      provide: EMBEDDER,
      inject: [ENV, OPENAI_CLIENT, OPENROUTER_CLIENT],
      useFactory: (env: Env, openai: OpenAI | null, openrouter: OpenAI | null): Embedder => {
        if (env.EMBEDDING_PROVIDER === 'openai') {
          return new OpenAiEmbedder(requireOpenAi(openai), {
            model: env.OPENAI_EMBED_MODEL,
            dimensions: env.EMBEDDING_DIMENSIONS,
          });
        }
        if (env.EMBEDDING_PROVIDER === 'openrouter') {
          // Só os text-embedding-3 aceitam encurtar o vetor; os outros já precisam ter o tamanho certo.
          return new OpenAiEmbedder(requireOpenRouter(openrouter), {
            model: env.OPENROUTER_EMBED_MODEL,
            dimensions: env.EMBEDDING_DIMENSIONS,
            sendDimensions: env.OPENROUTER_EMBED_MODEL.includes('text-embedding-3'),
            provider: OPENROUTER,
          });
        }
        return new OllamaEmbedder({
          baseUrl: env.OLLAMA_BASE_URL,
          model: env.OLLAMA_EMBED_MODEL,
          dimensions: env.EMBEDDING_DIMENSIONS,
        });
      },
    },
    {
      provide: LLM_CLIENT,
      inject: [ENV, OPENAI_CLIENT, OPENROUTER_CLIENT],
      useFactory: (env: Env, openai: OpenAI | null, openrouter: OpenAI | null): LlmClient => {
        if (env.LLM_PROVIDER === 'openai') {
          return new OpenAiLlmClient(requireOpenAi(openai), { model: env.OPENAI_CHAT_MODEL });
        }
        if (env.LLM_PROVIDER === 'openrouter') {
          return new OpenRouterLlmClient(requireOpenRouter(openrouter), {
            model: env.OPENROUTER_CHAT_MODEL,
          });
        }
        if (env.LLM_PROVIDER === 'anthropic' && env.ANTHROPIC_API_KEY) {
          return new AnthropicLlmClient({
            apiKey: env.ANTHROPIC_API_KEY,
            model: env.ANTHROPIC_MODEL,
          });
        }
        return new OllamaLlmClient({ baseUrl: env.OLLAMA_BASE_URL, model: env.OLLAMA_CHAT_MODEL });
      },
    },
    {
      // Verifica só os provedores em uso; a Anthropic não tem ping barato e falha no próprio stream.
      provide: LLM_HEALTH,
      inject: [ENV, OPENAI_CLIENT, OPENROUTER_CLIENT],
      useFactory: (env: Env, openai: OpenAI | null, openrouter: OpenAI | null): LlmHealth => {
        const parts: LlmHealth[] = [];
        const usesOllama = env.EMBEDDING_PROVIDER === 'ollama' || env.LLM_PROVIDER === 'ollama';
        const usesOpenAi = env.EMBEDDING_PROVIDER === 'openai' || env.LLM_PROVIDER === 'openai';
        if (usesOllama) parts.push(new OllamaHealth(env.OLLAMA_BASE_URL));
        if (usesOpenAi) {
          const model =
            env.LLM_PROVIDER === 'openai' ? env.OPENAI_CHAT_MODEL : env.OPENAI_EMBED_MODEL;
          parts.push(new OpenAiHealth(requireOpenAi(openai), model));
        }
        const usesOpenRouter =
          env.EMBEDDING_PROVIDER === 'openrouter' || env.LLM_PROVIDER === 'openrouter';
        if (usesOpenRouter) parts.push(new OpenRouterHealth(requireOpenRouter(openrouter)));
        return new CompositeHealth(parts);
      },
    },
  ],
  exports: [EMBEDDER, LLM_CLIENT, LLM_HEALTH],
})
export class LlmModule {}
