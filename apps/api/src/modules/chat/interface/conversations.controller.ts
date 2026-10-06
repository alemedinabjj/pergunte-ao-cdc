import {
  type ConversationDetail,
  type ConversationSummary,
  conversationDetailSchema,
  conversationSummarySchema,
} from '@cdc/contracts';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { z } from 'zod';
import { ConversationsRepository } from '../infrastructure/conversations.repository';
import { ZodValidationPipe } from './zod-validation.pipe';

const idPipe = new ZodValidationPipe(z.uuid());

const notFound = (id: string) =>
  new NotFoundException({ code: 'CONVERSATION_NOT_FOUND', message: `Conversa ${id} não existe` });

@Controller('conversations')
export class ConversationsController {
  constructor(
    @Inject(ConversationsRepository) private readonly conversations: ConversationsRepository,
  ) {}

  @Get()
  async list(): Promise<ConversationSummary[]> {
    return z.array(conversationSummarySchema).parse(await this.conversations.list());
  }

  @Get(':id')
  async get(@Param('id', idPipe) id: string): Promise<ConversationDetail> {
    const detail = await this.conversations.get(id);
    if (!detail) throw notFound(id);
    return conversationDetailSchema.parse(detail);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id', idPipe) id: string): Promise<void> {
    if (!(await this.conversations.delete(id))) throw notFound(id);
  }
}
