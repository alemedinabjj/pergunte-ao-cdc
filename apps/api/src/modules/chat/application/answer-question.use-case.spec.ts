import type { Citation, SseEvent } from '@cdc/contracts';
import { describe, expect, it } from 'vitest';
import { FakeLlmClient } from '../../../../test/fakes/fake-llm-client';
import { LlmUnavailableError } from '../../llm/domain/errors';
import type { ChatMessage } from '../../llm/domain/llm-client.port';
import type { RetrieveInput } from '../../retrieval/application/retrieve.use-case';
import type { RetrievalResult, RetrievedChunk } from '../../retrieval/domain/retrieval.types';
import { NOT_FOUND_ANSWER } from '../prompts/answer.prompt';
import {
  AnswerQuestionUseCase,
  ConversationNotFoundError,
  type ConversationsPort,
  type PreparedTurn,
} from './answer-question.use-case';

const CONVERSATION_ID = '3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607';

const chunk = (over: Partial<RetrievedChunk> = {}): RetrievedChunk => ({
  id: '0b0f2d3e-8a51-4e5e-9a3c-1f2d3e4a5b6c',
  lawSlug: 'cdc',
  lawShortName: 'CDC',
  path: 'Art. 49',
  article: '49',
  content: 'Art. 49. O consumidor pode desistir.',
  sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
  score: 0.03,
  similarity: 0.7,
  ...over,
});

class RetrieveStub {
  result: RetrievalResult = {
    chunks: [chunk(), chunk({ id: '1c1f2d3e-8a51-4e5e-9a3c-1f2d3e4a5b6c', path: 'Art. 18' })],
    topSimilarity: 0.7,
    exactMatch: false,
  };
  lastInput: RetrieveInput | null = null;
  async execute(input: RetrieveInput): Promise<RetrievalResult> {
    this.lastInput = input;
    return this.result;
  }
}

class RepoStub implements ConversationsPort {
  conversations = new Set<string>([CONVERSATION_ID]);
  users: { conversationId: string; content: string; standaloneQuery: string | null }[] = [];
  assistant: { content: string; status: string; citations: Citation[]; model: string | null }[] =
    [];
  historyRows: ChatMessage[] = [];
  async create(): Promise<string> {
    this.conversations.add('9a9b9c9d-0e0f-4a1b-8c2d-3e4f5a6b7c8d');
    return '9a9b9c9d-0e0f-4a1b-8c2d-3e4f5a6b7c8d';
  }
  async exists(id: string): Promise<boolean> {
    return this.conversations.has(id);
  }
  async history(): Promise<ChatMessage[]> {
    return this.historyRows;
  }
  async addUserMessage(conversationId: string, content: string, standaloneQuery: string | null) {
    this.users.push({ conversationId, content, standaloneQuery });
    return 'u';
  }
  async addAssistantMessage(m: {
    content: string;
    status: 'complete' | 'incomplete';
    citations: Citation[];
    model: string | null;
  }): Promise<void> {
    this.assistant.push(m);
  }
}

function setup(llm = new FakeLlmClient({ chunks: ['Pode ', 'sim [1].'] })) {
  const retrieve = new RetrieveStub();
  const repo = new RepoStub();
  const health = {
    up: true,
    unavailableMessage: 'Confira a OPENAI_API_KEY.',
    ping: async () => health.up,
  };
  const useCase = new AnswerQuestionUseCase(retrieve, llm, health, repo, {
    MIN_SIMILARITY: 0.5,
    LLM_TIMEOUT_MS: 5_000,
  });
  return { retrieve, repo, health, useCase, llm };
}

const turn: PreparedTurn = {
  conversationId: CONVERSATION_ID,
  isNew: false,
  question: 'Posso devolver?',
  history: [],
};

async function collect(iterable: AsyncIterable<SseEvent>, onEvent?: (e: SseEvent) => void) {
  const events: SseEvent[] = [];
  for await (const event of iterable) {
    events.push(event);
    onEvent?.(event);
  }
  return events;
}

describe('AnswerQuestionUseCase.run', () => {
  it('emits meta, citations, tokens and done in order', async () => {
    const { useCase } = setup();
    const events = await collect(useCase.run(turn, new AbortController().signal));
    expect(events.map((e) => e.type)).toEqual(['meta', 'citations', 'token', 'token', 'done']);
    expect(events[0]).toMatchObject({ type: 'meta', conversationId: CONVERSATION_ID });
  });

  it('done.citedIds lists only referenced documents and only those are saved', async () => {
    const { useCase, repo } = setup(new FakeLlmClient({ chunks: ['Pode [2].'] }));
    const events = await collect(useCase.run(turn, new AbortController().signal));
    expect(events.at(-1)).toMatchObject({ type: 'done', citedIds: [2], model: 'fake-llm' });
    expect(repo.assistant[0]?.citations.map((c) => c.id)).toEqual([2]);
    expect(repo.assistant[0]).toMatchObject({ status: 'complete', content: 'Pode [2].' });
  });

  it('saves the user message and retrieves with the question and law filter', async () => {
    const { useCase, repo, retrieve } = setup();
    await collect(useCase.run({ ...turn, lawSlug: 'cdc' }, new AbortController().signal));
    expect(repo.users).toEqual([
      { conversationId: CONVERSATION_ID, content: 'Posso devolver?', standaloneQuery: null },
    ]);
    expect(retrieve.lastInput).toEqual({ text: 'Posso devolver?', lawSlug: 'cdc' });
  });

  it('refuses without calling the LLM when similarity is low and no exact match', async () => {
    const { useCase, retrieve, llm, repo } = setup();
    retrieve.result = { chunks: [chunk()], topSimilarity: 0.2, exactMatch: false };
    const events = await collect(useCase.run(turn, new AbortController().signal));
    expect(llm.requests).toHaveLength(0);
    expect(events.find((e) => e.type === 'citations')).toEqual({ type: 'citations', items: [] });
    expect(events.find((e) => e.type === 'token')).toEqual({
      type: 'token',
      text: NOT_FOUND_ANSWER,
    });
    expect(events.at(-1)).toMatchObject({ type: 'done', citedIds: [], model: null });
    expect(repo.assistant[0]).toMatchObject({ content: NOT_FOUND_ANSWER, status: 'complete' });
  });

  it('refuses when retrieval returns nothing', async () => {
    const { useCase, retrieve, llm } = setup();
    retrieve.result = { chunks: [], topSimilarity: null, exactMatch: false };
    await collect(useCase.run(turn, new AbortController().signal));
    expect(llm.requests).toHaveLength(0);
  });

  it('does not refuse when the article was referenced exactly', async () => {
    const { useCase, retrieve, llm } = setup();
    retrieve.result = { chunks: [chunk()], topSimilarity: 0.1, exactMatch: true };
    await collect(useCase.run(turn, new AbortController().signal));
    expect(llm.requests).toHaveLength(1);
  });

  it('saves a partial answer as incomplete when the client aborts', async () => {
    const { useCase, repo } = setup(new FakeLlmClient({ chunks: ['Pode', ' sim'], delayMs: 5 }));
    const controller = new AbortController();
    const events = await collect(useCase.run(turn, controller.signal), (e) => {
      if (e.type === 'token') controller.abort();
    });
    expect(events.map((e) => e.type)).toEqual(['meta', 'citations', 'token']);
    expect(repo.assistant).toEqual([
      expect.objectContaining({ status: 'incomplete', content: 'Pode' }),
    ]);
  });

  it('saves incomplete when the consumer stops iterating', async () => {
    const { useCase, repo } = setup(new FakeLlmClient({ chunks: ['Pode', ' sim'] }));
    for await (const event of useCase.run(turn, new AbortController().signal)) {
      if (event.type === 'token') break;
    }
    expect(repo.assistant).toEqual([
      expect.objectContaining({ status: 'incomplete', content: 'Pode' }),
    ]);
  });

  it('emits error and saves incomplete when the LLM fails mid-stream', async () => {
    const { useCase, repo } = setup(new FakeLlmClient({ chunks: ['a', 'b'], failAfter: 1 }));
    const events = await collect(useCase.run(turn, new AbortController().signal));
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'LLM_FAILED' });
    expect(repo.assistant[0]).toMatchObject({ status: 'incomplete', content: 'a' });
  });

  it('emits TIMEOUT when generation exceeds the time limit', async () => {
    const llm = new FakeLlmClient({ chunks: ['a', 'b', 'c'], delayMs: 40 });
    const { repo } = setup();
    const useCase = new AnswerQuestionUseCase(
      new RetrieveStub(),
      llm,
      { ping: async () => true, unavailableMessage: '' },
      repo,
      {
        MIN_SIMILARITY: 0.5,
        LLM_TIMEOUT_MS: 50,
      },
    );
    const events = await collect(useCase.run(turn, new AbortController().signal));
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'TIMEOUT' });
  });
});

describe('AnswerQuestionUseCase.prepare', () => {
  it('creates a conversation titled after the question', async () => {
    const { useCase } = setup();
    const prepared = await useCase.prepare({
      question: 'Posso devolver um produto comprado pela internet depois de uma semana?',
    });
    expect(prepared).toMatchObject({ isNew: true, history: [] });
  });

  it('throws ConversationNotFoundError for an unknown id', async () => {
    const { useCase } = setup();
    await expect(
      useCase.prepare({
        question: 'oi oi',
        conversationId: '00000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toBeInstanceOf(ConversationNotFoundError);
  });

  it('throws LlmUnavailableError with the provider message when it is down', async () => {
    const { useCase, health } = setup();
    health.up = false;
    await expect(useCase.prepare({ question: 'posso devolver?' })).rejects.toThrow(
      new LlmUnavailableError('Confira a OPENAI_API_KEY.'),
    );
  });
});
