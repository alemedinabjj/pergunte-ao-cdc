import { type ChatRequest, chatRequestSchema } from '@cdc/contracts';
import {
  Body,
  Controller,
  Inject,
  NotFoundException,
  Post,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { LlmUnavailableError } from '../../llm/domain/errors';
import {
  AnswerQuestionUseCase,
  ConversationNotFoundError,
  type PreparedTurn,
} from '../application/answer-question.use-case';
import { openSseStream, writeSseEvent } from './sse';
import { ZodValidationPipe } from './zod-validation.pipe';

@Controller('chat')
@UseGuards(ThrottlerGuard)
export class ChatController {
  constructor(@Inject(AnswerQuestionUseCase) private readonly answer: AnswerQuestionUseCase) {}

  /**
   * POST + SSE escrito direto na Response: EventSource e @Sse() só fazem GET sem corpo.
   * Erros conhecidos antes do stream viram 404/503; depois dele, viram evento `error`.
   */
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async chat(
    @Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest,
    @Res() res: Response,
  ): Promise<void> {
    let turn: PreparedTurn;
    try {
      turn = await this.answer.prepare(body);
    } catch (error) {
      if (error instanceof ConversationNotFoundError) {
        throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND', message: error.message });
      }
      if (error instanceof LlmUnavailableError) {
        throw new ServiceUnavailableException({ code: 'LLM_UNAVAILABLE', message: error.message });
      }
      throw error;
    }

    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    openSseStream(res);
    for await (const event of this.answer.run(turn, controller.signal)) {
      if (controller.signal.aborted) break;
      writeSseEvent(res, event);
    }
    if (!res.writableEnded) res.end();
  }
}
