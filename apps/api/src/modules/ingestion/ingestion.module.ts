import { Module } from '@nestjs/common';
import { ConfigModule } from '../../config/config.module';
import { ENV, type Env } from '../../config/env';
import { DatabaseModule } from '../../database/database.module';
import { EMBEDDER, type Embedder } from '../llm/domain/embedder.port';
import { LlmModule } from '../llm/llm.module';
import { ChunksRepository } from './chunks.repository';
import { IngestLawUseCase } from './ingest-law.use-case';

@Module({
  imports: [ConfigModule, DatabaseModule, LlmModule],
  providers: [
    ChunksRepository,
    {
      provide: IngestLawUseCase,
      inject: [ChunksRepository, EMBEDDER, ENV],
      useFactory: (repository: ChunksRepository, embedder: Embedder, env: Env) =>
        new IngestLawUseCase(repository, embedder, {
          dimensions: env.EMBEDDING_DIMENSIONS,
          lawsDir: env.LAWS_DIR,
        }),
    },
  ],
  exports: [IngestLawUseCase],
})
export class IngestionModule {}
