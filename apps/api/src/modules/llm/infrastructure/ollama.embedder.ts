import { z } from 'zod';
import type { Embedder } from '../domain/embedder.port';
import { ollamaPost } from './ollama-http';

const embedResponseSchema = z.object({ embeddings: z.array(z.array(z.number())) });

export interface OllamaEmbedderConfig {
  baseUrl: string;
  model: string;
  dimensions: number;
}

export class OllamaEmbedder implements Embedder {
  readonly model: string;
  readonly dimensions: number;

  constructor(private readonly config: OllamaEmbedderConfig) {
    this.model = config.model;
    this.dimensions = config.dimensions;
  }

  async embed(texts: string[], signal?: AbortSignal): Promise<number[][]> {
    const response = await ollamaPost(
      this.config.baseUrl,
      '/api/embed',
      { model: this.model, input: texts },
      this.model,
      signal,
    );
    return embedResponseSchema.parse(await response.json()).embeddings;
  }
}
