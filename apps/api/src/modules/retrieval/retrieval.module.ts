import { Module } from '@nestjs/common';
import { RetrieveUseCase } from './application/retrieve.use-case';
import { HybridRetriever } from './infrastructure/hybrid.retriever';

@Module({
  providers: [HybridRetriever, RetrieveUseCase],
  exports: [RetrieveUseCase],
})
export class RetrievalModule {}
