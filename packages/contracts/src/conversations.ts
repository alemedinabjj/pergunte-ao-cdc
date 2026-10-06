import { z } from 'zod';
import { citationSchema } from './chat';

export const conversationSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

export const messageSchema = z.object({
  id: z.uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  status: z.enum(['complete', 'incomplete']),
  citations: z.array(citationSchema).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Message = z.infer<typeof messageSchema>;

export const conversationDetailSchema = conversationSummarySchema.extend({
  messages: z.array(messageSchema),
});
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;
