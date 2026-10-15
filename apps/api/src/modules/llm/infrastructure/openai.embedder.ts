import type { Embedder } from '../domain/embedder.port';
import { LlmRequestError } from '../domain/errors';
import { mapOpenAiError, OPENAI, type OpenAiCompatibleProvider } from './openai.errors';

/** O pedaço do SDK que o adapter usa; o cliente real `new OpenAI()` satisfaz esse tipo. */
export interface OpenAiEmbeddingsApi {
  embeddings: {
    create(
      body: { model: string; input: string[]; dimensions?: number; encoding_format: 'float' },
      options?: { signal?: AbortSignal },
    ): Promise<{ data: { index: number; embedding: number[] }[] }>;
  };
}

export interface OpenAiEmbedderConfig {
  model: string;
  /** Os modelos text-embedding-3 aceitam encurtar o vetor sem perder as propriedades semânticas. */
  dimensions: number;
  /** Modelos que já geram o tamanho certo (e não aceitam o parâmetro) usam `false`. */
  sendDimensions?: boolean;
  provider?: OpenAiCompatibleProvider;
}

/** Embeddings pela API da OpenAI ou por qualquer serviço compatível, como a OpenRouter. */
export class OpenAiEmbedder implements Embedder {
  readonly model: string;
  readonly dimensions: number;
  private readonly sendDimensions: boolean;
  private readonly provider: OpenAiCompatibleProvider;

  constructor(
    private readonly client: OpenAiEmbeddingsApi,
    config: OpenAiEmbedderConfig,
  ) {
    this.model = config.model;
    this.dimensions = config.dimensions;
    this.sendDimensions = config.sendDimensions ?? true;
    this.provider = config.provider ?? OPENAI;
  }

  async embed(texts: string[], signal?: AbortSignal): Promise<number[][]> {
    let vectors: number[][];
    try {
      const response = await this.client.embeddings.create(
        {
          model: this.model,
          input: texts,
          ...(this.sendDimensions ? { dimensions: this.dimensions } : {}),
          encoding_format: 'float',
        },
        { signal },
      );
      vectors = [...response.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
    } catch (error) {
      throw mapOpenAiError(error, this.provider);
    }
    const wrong = vectors.find((vector) => vector.length !== this.dimensions);
    if (wrong) {
      throw new LlmRequestError(
        `${this.model} devolveu vetores de ${wrong.length} dimensões, mas o banco espera ${this.dimensions}.`,
      );
    }
    return vectors;
  }
}
