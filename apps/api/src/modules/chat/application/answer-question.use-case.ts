import { randomUUID } from 'node:crypto';
import type { ChatRequest, Citation, LawSlug, SseEvent } from '@cdc/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../../../config/env';
import { LlmRequestError, LlmUnavailableError } from '../../llm/domain/errors';
import { type ChatMessage, LLM_CLIENT, type LlmClient } from '../../llm/domain/llm-client.port';
import { LLM_HEALTH, type LlmHealth } from '../../llm/domain/llm-health.port';
import { RetrieveUseCase } from '../../retrieval/application/retrieve.use-case';
import type { RetrievalResult } from '../../retrieval/domain/retrieval.types';
import { extractCitedIds, toCitations } from '../domain/citations';
import {
  ConversationsRepository,
  type NewAssistantMessage,
} from '../infrastructure/conversations.repository';
import { buildAnswerPrompt, NOT_FOUND_ANSWER } from '../prompts/answer.prompt';
import { buildRewritePrompt, sanitizeRewrite } from '../prompts/rewrite.prompt';

export class ConversationNotFoundError extends Error {
  override readonly name = 'ConversationNotFoundError';
}

export interface PreparedTurn {
  conversationId: string;
  isNew: boolean;
  question: string;
  lawSlug?: LawSlug;
  history: ChatMessage[];
}

export type ConversationsPort = Pick<
  ConversationsRepository,
  'create' | 'exists' | 'history' | 'addUserMessage' | 'addAssistantMessage'
>;
type RetrievePort = Pick<RetrieveUseCase, 'execute'>;
type AnswerConfig = Pick<Env, 'MIN_SIMILARITY' | 'LLM_TIMEOUT_MS'>;

const TITLE_MAX = 60;
const HISTORY_LIMIT = 6;

function titleFrom(question: string): string {
  const trimmed = question.trim();
  return trimmed.length > TITLE_MAX ? `${trimmed.slice(0, TITLE_MAX).trimEnd()}…` : trimmed;
}

@Injectable()
export class AnswerQuestionUseCase {
  private readonly logger = new Logger(AnswerQuestionUseCase.name);

  constructor(
    @Inject(RetrieveUseCase) private readonly retrieve: RetrievePort,
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    @Inject(LLM_HEALTH) private readonly health: LlmHealth,
    @Inject(ConversationsRepository) private readonly conversations: ConversationsPort,
    @Inject(ENV) private readonly config: AnswerConfig,
  ) {}

  /** Tudo que pode falhar antes de abrir o stream (vira 404/503 em vez de evento de erro). */
  async prepare(input: ChatRequest): Promise<PreparedTurn> {
    if (!(await this.health.ping())) throw new LlmUnavailableError(this.health.unavailableMessage);
    const base = { question: input.question, lawSlug: input.lawSlug, history: [] };
    if (input.conversationId) {
      if (!(await this.conversations.exists(input.conversationId))) {
        throw new ConversationNotFoundError(`Conversa ${input.conversationId} não existe`);
      }
      const history = await this.conversations.history(input.conversationId, HISTORY_LIMIT);
      return { ...base, history, conversationId: input.conversationId, isNew: false };
    }
    const conversationId = await this.conversations.create(titleFrom(input.question));
    return { ...base, conversationId, isNew: true };
  }

  async *run(turn: PreparedTurn, signal: AbortSignal): AsyncGenerator<SseEvent> {
    const startedAt = Date.now();
    const messageId = randomUUID();
    const llmSignal = AbortSignal.any([signal, AbortSignal.timeout(this.config.LLM_TIMEOUT_MS)]);

    let answer = '';
    let citations: Citation[] = [];
    let model: string | null = null;
    let saved = false;

    const save = async (status: 'complete' | 'incomplete', cited: Citation[]) => {
      saved = true;
      const message: NewAssistantMessage = {
        id: messageId,
        conversationId: turn.conversationId,
        content: answer,
        status,
        citations: cited,
        model,
        latencyMs: Date.now() - startedAt,
      };
      await this.conversations.addAssistantMessage(message);
    };

    yield { type: 'meta', conversationId: turn.conversationId, messageId };

    try {
      const standalone = await this.standaloneQuestion(turn, llmSignal);
      await this.conversations.addUserMessage(
        turn.conversationId,
        turn.question,
        standalone === turn.question ? null : standalone,
      );
      const result = await this.retrieve.execute(
        { text: standalone, lawSlug: turn.lawSlug },
        llmSignal,
      );

      if (this.shouldRefuse(result)) {
        yield { type: 'citations', items: [] };
        answer = NOT_FOUND_ANSWER;
        yield { type: 'token', text: answer };
        await save('complete', []);
        yield { type: 'done', citedIds: [], model: null, latencyMs: Date.now() - startedAt };
        return;
      }

      citations = toCitations(result.chunks);
      yield { type: 'citations', items: citations };

      model = this.llm.model;
      const prompt = buildAnswerPrompt(standalone, citations);
      for await (const piece of this.llm.stream(prompt, llmSignal)) {
        answer += piece;
        yield { type: 'token', text: piece };
      }

      const citedIds = extractCitedIds(answer, citations.length);
      await save(
        'complete',
        citations.filter((c) => citedIds.includes(c.id)),
      );
      yield { type: 'done', citedIds, model, latencyMs: Date.now() - startedAt };
    } catch (error) {
      if (signal.aborted) return; // cliente foi embora: o finally salva o parcial
      const event = this.toErrorEvent(error, llmSignal);
      if (event.code === 'INTERNAL') this.logger.error(error);
      await save('incomplete', []);
      yield event;
    } finally {
      if (!saved) {
        await save('incomplete', []).catch((error: unknown) => this.logger.error(error));
      }
    }
  }

  /** Follow-ups ("e se for online?") viram perguntas independentes antes da busca. */
  private async standaloneQuestion(turn: PreparedTurn, signal: AbortSignal): Promise<string> {
    if (turn.history.length === 0) return turn.question;
    try {
      const output = await this.llm.complete(
        buildRewritePrompt(turn.history, turn.question),
        signal,
      );
      return sanitizeRewrite(output, turn.question);
    } catch (error) {
      if (!(error instanceof LlmRequestError)) throw error;
      this.logger.warn('Reescrita da pergunta falhou; usando a pergunta original');
      return turn.question;
    }
  }

  private shouldRefuse(result: RetrievalResult): boolean {
    if (result.chunks.length === 0) return true;
    return !result.exactMatch && (result.topSimilarity ?? 0) < this.config.MIN_SIMILARITY;
  }

  private toErrorEvent(
    error: unknown,
    llmSignal: AbortSignal,
  ): Extract<SseEvent, { type: 'error' }> {
    if (llmSignal.aborted) {
      return {
        type: 'error',
        code: 'TIMEOUT',
        message: 'A resposta demorou demais e foi interrompida. Tente de novo.',
      };
    }
    if (error instanceof LlmUnavailableError) {
      return { type: 'error', code: 'LLM_UNAVAILABLE', message: error.message };
    }
    if (error instanceof LlmRequestError) {
      return {
        type: 'error',
        code: 'LLM_FAILED',
        message: 'O modelo falhou ao gerar a resposta. Tente de novo.',
      };
    }
    return { type: 'error', code: 'INTERNAL', message: 'Erro interno ao gerar a resposta.' };
  }
}
