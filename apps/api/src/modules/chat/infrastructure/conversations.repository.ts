import type { Citation, ConversationDetail, ConversationSummary } from '@cdc/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { DB, type Db } from '../../../database/database.module';
import { conversations, messages } from '../../../database/schema';
import type { ChatMessage } from '../../llm/domain/llm-client.port';

export interface NewAssistantMessage {
  id: string;
  conversationId: string;
  content: string;
  status: 'complete' | 'incomplete';
  citations: Citation[];
  model: string | null;
  latencyMs: number;
}

@Injectable()
export class ConversationsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(title: string): Promise<string> {
    const [row] = await this.db
      .insert(conversations)
      .values({ title })
      .returning({ id: conversations.id });
    if (!row) throw new Error('Falha ao criar conversa');
    return row.id;
  }

  async exists(id: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    return rows.length > 0;
  }

  /** Últimas `limit` mensagens completas, em ordem cronológica. */
  async history(id: string, limit: number): Promise<ChatMessage[]> {
    const rows = await this.db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(and(eq(messages.conversationId, id), eq(messages.status, 'complete')))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    return rows.reverse();
  }

  async addUserMessage(
    conversationId: string,
    content: string,
    standaloneQuery: string | null,
  ): Promise<string> {
    const [row] = await this.db
      .insert(messages)
      .values({ conversationId, role: 'user', content, standaloneQuery })
      .returning({ id: messages.id });
    if (!row) throw new Error('Falha ao salvar mensagem');
    return row.id;
  }

  async addAssistantMessage(m: NewAssistantMessage): Promise<void> {
    await this.db.insert(messages).values({ ...m, role: 'assistant' });
  }

  async list(): Promise<ConversationSummary[]> {
    const rows = await this.db.select().from(conversations).orderBy(desc(conversations.createdAt));
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async get(id: string): Promise<ConversationDetail | null> {
    const [conversation] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    if (!conversation) return null;
    const rows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));
    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      messages: rows.map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        status: row.status,
        citations: row.citations ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(conversations)
      .where(eq(conversations.id, id))
      .returning({ id: conversations.id });
    return rows.length > 0;
  }
}
