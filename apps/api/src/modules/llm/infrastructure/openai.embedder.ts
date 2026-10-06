import type { Embedder } from '../domain/embedder.port';
import { mapOpenAiError } from './openai.errors';

/** O pedaço do SDK que o adapter usa; o cliente real `new OpenAI()` satisfaz esse tipo. */
export interface OpenAiEmbeddingsApi {
  embeddings: {
    create(
      body: { model: string; input: string[]; dimensions: number; encoding_format: 'float' },
      options?: { signal?: AbortSignal },
    ): Promise<{ data: { index: number; embedding: number[] }[] }>;
  };
}

export interface OpenAiEmbedderConfig {
  model: string;
  /** Os modelos text-embedding-3 aceitam encurtar o vetor sem perder as propriedades semânticas. */
  dimensions: number;
}

export class OpenAiEmbedder implements Embedder {
  readonly model: string;
  readonly dimensions: number;

  constructor(
    private readonly client: OpenAiEmbeddingsApi,
    config: OpenAiEmbedderConfig,
  ) {
    this.model = config.model;
    this.dimensions = config.dimensions;
  }

  async embed(texts: string[], signal?: AbortSignal): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create(
        { model: this.model, input: texts, dimensions: this.dimensions, encoding_format: 'float' },
        { signal },
      );
      return [...response.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
    } catch (error) {
      throw mapOpenAiError(error);
    }
  }
}
