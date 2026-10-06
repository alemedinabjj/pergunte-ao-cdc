import type { Citation } from '@cdc/contracts';
import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  smallserial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

/** Preenchido no INSERT com to_tsvector('pt_unaccent', ...): unaccent não é IMMUTABLE. */
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

export const EMBEDDING_DIMENSIONS = 1024;

export const laws = pgTable('laws', {
  id: smallserial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  shortName: text('short_name').notNull(),
  reference: text('reference').notNull(),
  sourceUrl: text('source_url').notNull(),
});

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lawId: smallint('law_id')
      .notNull()
      .references(() => laws.id),
    path: text('path').notNull(),
    article: text('article').notNull(),
    breadcrumb: text('breadcrumb').notNull(),
    content: text('content').notNull(),
    embeddedText: text('embedded_text').notNull(),
    tsv: tsvector('tsv').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    embeddingModel: text('embedding_model').notNull(),
    contentHash: text('content_hash').notNull(),
    position: integer('position').notNull(),
  },
  (t) => [
    uniqueIndex('chunks_law_path_uq').on(t.lawId, t.path),
    index('chunks_embedding_hnsw').using('hnsw', t.embedding.op('vector_cosine_ops')),
    index('chunks_tsv_gin').using('gin', t.tsv),
    index('chunks_law_id_idx').on(t.lawId),
    index('chunks_law_article_idx').on(t.lawId, t.article),
  ],
);

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    status: text('status', { enum: ['complete', 'incomplete'] })
      .notNull()
      .default('complete'),
    standaloneQuery: text('standalone_query'),
    citations: jsonb('citations').$type<Citation[]>(),
    model: text('model'),
    latencyMs: integer('latency_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('messages_conversation_created_idx').on(t.conversationId, t.createdAt),
    check('messages_role_check', sql`${t.role} IN ('user', 'assistant')`),
    check('messages_status_check', sql`${t.status} IN ('complete', 'incomplete')`),
  ],
);
