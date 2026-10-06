import { Module } from '@nestjs/common';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { AnswerQuestionUseCase } from './application/answer-question.use-case';
import { ConversationsRepository } from './infrastructure/conversations.repository';
import { ChatController } from './interface/chat.controller';
import { ConversationsController } from './interface/conversations.controller';
import { HealthController } from './interface/health.controller';
import { LawsController } from './interface/laws.controller';

@Module({
  imports: [RetrievalModule],
  controllers: [ChatController, ConversationsController, LawsController, HealthController],
  providers: [ConversationsRepository, AnswerQuestionUseCase],
})
export class ChatModule {}
